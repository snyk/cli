export = monitor;

import * as _ from 'lodash';
import * as fs from 'then-fs';
import { apiTokenExists } from '../../../lib/api-token';
import snyk = require('../../../lib'); // TODO(kyegupov): fix import
import { monitor as snykMonitor } from '../../../lib/monitor';
import * as config from '../../../lib/config';
import * as url from 'url';
import chalk from 'chalk';
import * as pathUtil from 'path';
import * as spinner from '../../../lib/spinner';

import * as detect from '../../../lib/detect';
import * as plugins from '../../../lib/plugins';
import { ModuleInfo } from '../../../lib/module-info'; // TODO(kyegupov): fix import
import { MonitorOptions, MonitorMeta } from '../../../lib/types';
import { MethodArgs, ArgsOptions } from '../../args';
import { maybePrintDeps } from '../../../lib/print-deps';
import * as analytics from '../../../lib/analytics';
import {
  AuthFailedError,
  MonitorError,
  UnsupportedFeatureFlagError,
} from '../../../lib/errors';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { isFeatureFlagSupportedForOrg } from '../../../lib/feature-flags';
import { formatMonitorOutput } from './formatters/format-monitor-response';

const SEPARATOR = '\n-------------------------------------------------------\n';

interface GoodResult {
  ok: true;
  data: string;
  path: string;
  projectName?: string;
}

interface BadResult {
  ok: false;
  data: MonitorError;
  path: string;
}

// This is used instead of `let x; try { x = await ... } catch { cleanup }` to avoid
// declaring the type of x as possibly undefined.
async function promiseOrCleanup<T>(
  p: Promise<T>,
  cleanup: (x?) => void,
): Promise<T> {
  return p.catch((error) => {
    cleanup();
    throw error;
  });
}

// detects package manager
// loads appropriate plugin and inspects for dependencies
// finally posts dependencies to registry
async function detectInspectMonitor(
  path: string,
  options: MonitorOptions = {},
): Promise<GoodResult | BadResult> {
  try {
    await validateMonitorPath(path, options.docker);

    let packageManager = detect.detectPackageManager(path, options);

    const targetFile =
      options.docker && !options.file // snyk monitor --docker (without --file)
        ? undefined
        : options.file || detect.detectPackageFile(path);

    const plugin = plugins.loadPlugin(packageManager, options);

    const moduleInfo = ModuleInfo(plugin, options.policy);

    const displayPath = pathUtil.relative(
      '.',
      pathUtil.join(path, targetFile || ''),
    );

    const analysisType = options.docker ? 'docker' : packageManager;

    const analyzingDepsSpinnerLabel =
      'Analyzing ' + analysisType + ' dependencies for ' + displayPath;

    const postingMonitorSpinnerLabel =
      'Posting monitor snapshot for ' + displayPath + ' ...';

    await spinner(analyzingDepsSpinnerLabel);

    // Scan the project dependencies via a plugin

    analytics.add('packageManager', packageManager);
    analytics.add('pluginOptions', options);

    // TODO: the type should depend on allSubProjects flag
    const inspectResult: pluginApi.InspectResult = await promiseOrCleanup(
      moduleInfo.inspect(path, targetFile, { ...options }),
      spinner.clear(analyzingDepsSpinnerLabel),
    );

    analytics.add('pluginName', inspectResult.plugin.name);

    await spinner.clear(analyzingDepsSpinnerLabel)(inspectResult);

    await spinner(postingMonitorSpinnerLabel);
    if (inspectResult.plugin.packageManager) {
      packageManager = inspectResult.plugin.packageManager;
    }
    const meta: MonitorMeta = {
      method: 'cli',
      packageManager,
      'policy-path': options['policy-path'],
      'project-name': options['project-name'] || config.PROJECT_NAME,
      isDocker: !!options.docker,
      prune: !!options['prune-repeated-subdependencies'],
      'experimental-dep-graph': !!options['experimental-dep-graph'],
      'remote-repo-url': options['remote-repo-url'],
    };

    // We send results from "all-sub-projects" scanning as different Monitor objects

    // SinglePackageResult is a legacy format understood by Registry, so we have to convert
    // a MultiProjectResult to an array of these.

    let perProjectResult: pluginApi.SinglePackageResult[] = [];
    let foundProjectCount;
    if (pluginApi.isMultiResult(inspectResult)) {
      perProjectResult = convertMultiPluginResultToSingle(inspectResult);
    } else {
      foundProjectCount = getSubProjectCount(inspectResult);
      perProjectResult = [inspectResult];
    }

    // Post the project dependencies to the Registry
    for (const projectDeps of perProjectResult) {
      maybePrintDeps(options, projectDeps.package);

      const res = await promiseOrCleanup(
        snykMonitor(path, meta, projectDeps, targetFile),
        spinner.clear(postingMonitorSpinnerLabel),
      );

      await spinner.clear(postingMonitorSpinnerLabel)(res);

      res.path = path;
      const endpoint = url.parse(config.API);
      let leader = '';
      if (res.org) {
        leader = '/org/' + res.org;
      }
      endpoint.pathname = leader + '/manage';
      const manageUrl = url.format(endpoint);

      endpoint.pathname = leader + '/monitor/' + res.id;
      const projectName = pluginApi.isMultiResult(inspectResult)
        ? projectDeps.package.name
        : undefined;
      const monOutput = formatMonitorOutput(
        packageManager,
        res,
        manageUrl,
        options,
        projectName,
        foundProjectCount,
      );
      return { ok: true, data: monOutput, path, projectName };
    }
  } catch (err) {
    return { ok: false, data: err, path };
  }
  return {
    ok: false,
    data: new MonitorError(500, 'Failed to monitor path.'),
    path,
  };
}

// Returns an array of Registry responses (one per every sub-project scanned), a single response,
// or an error message.
async function monitor(...args0: MethodArgs): Promise<any> {
  let args = [...args0];
  let options: MonitorOptions = {};
  if (typeof args[args.length - 1] === 'object') {
    options = (args.pop() as ArgsOptions) as MonitorOptions;
  }

  args = args.filter(Boolean);

  // populate with default path (cwd) if no path given
  if (args.length === 0) {
    args.unshift(process.cwd());
  }

  if (options.id) {
    snyk.id = options.id;
  }

  if (options.allSubProjects && options['project-name']) {
    throw new Error(
      '`--all-sub-projects` is currently not compatible with `--project-name`',
    );
  }

  if (options.docker && options['remote-repo-url']) {
    throw new Error('`--remote-repo-url` is not supported for container scans');
  }

  apiTokenExists();

  if (options['experimental-dep-graph']) {
    const isFFSupported = await isFeatureFlagSupportedForOrg(
      _.camelCase('experimental-dep-graph'),
    );

    if (isFFSupported.code === 401) {
      throw AuthFailedError(isFFSupported.error, isFFSupported.code);
    }

    if (!isFFSupported.ok) {
      throw new UnsupportedFeatureFlagError(
        'experimental-dep-graph',
        isFFSupported.userMessage,
      );
    }
  }

  // Part 1: every argument is a scan target; process them asynchronously
  const results = await Promise.all(
    (args as string[]).map((arg) => detectInspectMonitor(arg, options)),
  );

  // Part 2: process the output from the Registry
  if (options.json) {
    let dataToSend = results.map((result) => {
      if (result.ok) {
        const jsonData = JSON.parse(result.data);
        if (result.projectName) {
          jsonData.projectName = result.projectName;
        }
        return jsonData;
      }
      return { ok: false, error: result.data.message, path: result.path };
    });
    // backwards compat - strip array if only one result
    dataToSend = dataToSend.length === 1 ? dataToSend[0] : dataToSend;
    const json = JSON.stringify(dataToSend, null, 2);

    if (results.every((res) => res.ok)) {
      return json;
    }

    throw new Error(json);
  }

  const output = results
    .map((res) => {
      if (res.ok) {
        return res.data;
      }

      const errorMessage =
        res.data && res.data.userMessage
          ? chalk.bold.red(res.data.userMessage)
          : res.data
          ? res.data.message
          : 'Unknown error occurred.';

      return (
        chalk.bold.white('\nMonitoring ' + res.path + '...\n\n') + errorMessage
      );
    })
    .join('\n' + SEPARATOR);

  if (results.every((res) => res.ok)) {
    return output;
  }

  throw new Error(output);
}

function convertMultiPluginResultToSingle(
  result: pluginApi.MultiProjectResult,
): pluginApi.SinglePackageResult[] {
  return result.scannedProjects.map((scannedProject) => ({
    plugin: result.plugin,
    package: scannedProject.depTree,
  }));
}

function getSubProjectCount(inspectResult): number | null {
  if (
    inspectResult.plugin.meta &&
    inspectResult.plugin.meta.allSubProjectNames &&
    inspectResult.plugin.meta.allSubProjectNames.length > 1
  ) {
    return inspectResult.plugin.meta.allSubProjectNames.length;
  }

  return null;
}

async function validateMonitorPath(path, isDocker) {
  const exists = await fs.exists(path);
  if (!exists && !isDocker) {
    throw new Error('"' + path + '" is not a valid path for "snyk monitor"');
  }
}
