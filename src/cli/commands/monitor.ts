export = monitor;

import * as _ from 'lodash';
import * as fs from 'then-fs';
import { apiTokenExists } from '../../lib/api-token';
import snyk = require('../../lib/'); // TODO(kyegupov): fix import
import { monitor as snykMonitor } from '../../lib/monitor';
import * as config from '../../lib/config';
import * as url from 'url';
import chalk from 'chalk';
import * as pathUtil from 'path';
import * as spinner from '../../lib/spinner';

import * as detect from '../../lib/detect';
import * as plugins from '../../lib/plugins';
import { ModuleInfo } from '../../lib/module-info'; // TODO(kyegupov): fix import
import { MonitorOptions, MonitorMeta, MonitorResult } from '../../lib/types';
import { MethodArgs, ArgsOptions } from '../args';
import { maybePrintDeps } from '../../lib/print-deps';
import * as analytics from '../../lib/analytics';
import { MonitorError, UnsupportedFeatureFlagError } from '../../lib/errors';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { isFeatureFlagSupportedForOrg } from '../../lib/feature-flags';

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

// Returns an array of Registry responses (one per every sub-project scanned), a single response,
// or an error message.
async function monitor(...args0: MethodArgs): Promise<any> {
  let args = [...args0];
  let options: MonitorOptions = {};
  const results: Array<GoodResult | BadResult> = [];
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

    if (!isFFSupported.ok) {
      throw new UnsupportedFeatureFlagError(
        'experimental-dep-graph',
        isFFSupported.userMessage,
      );
    }
  }

  // Part 1: every argument is a scan target; process them sequentially
  for (const path of args as string[]) {
    try {
      const exists = await fs.exists(path);
      if (!exists && !options.docker) {
        throw new Error(
          '"' + path + '" is not a valid path for "snyk monitor"',
        );
      }

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
        packageManager: packageManager,
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
      let advertiseSubprojectsCount: number | null = null;
      if (pluginApi.isMultiResult(inspectResult)) {
        perProjectResult = inspectResult.scannedProjects.map(
          (scannedProject) => ({
            plugin: inspectResult.plugin,
            package: scannedProject.depTree,
          }),
        );
      } else {
        if (
          !options['gradle-sub-project'] &&
          inspectResult.plugin.meta &&
          inspectResult.plugin.meta.allSubProjectNames &&
          inspectResult.plugin.meta.allSubProjectNames.length > 1
        ) {
          advertiseSubprojectsCount =
            inspectResult.plugin.meta.allSubProjectNames.length;
        }
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
          advertiseSubprojectsCount,
        );
        results.push({ ok: true, data: monOutput, path, projectName });
      }
      // push a good result
    } catch (err) {
      // push this error, the loop continues
      results.push({ ok: false, data: err, path });
    }
  }
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

function formatMonitorOutput(
  packageManager,
  res: MonitorResult,
  manageUrl,
  options,
  projectName?: string,
  advertiseSubprojectsCount?: number | null,
) {
  const issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  const humanReadableName = projectName
    ? `${res.path} (${projectName})`
    : res.path;
  const strOutput =
    chalk.bold.white('\nMonitoring ' + humanReadableName + '...\n\n') +
    (packageManager === 'yarn'
      ? 'A yarn.lock file was detected - continuing as a Yarn project.\n'
      : '') +
    'Explore this snapshot at ' +
    res.uri +
    '\n\n' +
    (advertiseSubprojectsCount
      ? chalk.bold.white(
          `This project has multiple sub-projects (${advertiseSubprojectsCount}), ` +
            'use --all-sub-projects flag to scan all sub-projects.\n\n',
        )
      : '') +
    (res.isMonitored
      ? 'Notifications about newly disclosed ' +
        issues +
        ' related ' +
        'to these dependencies will be emailed to you.\n'
      : chalk.bold.red(
          'Project is inactive, so notifications are turned ' +
            'off.\nActivate this project here: ' +
            manageUrl +
            '\n\n',
        )) +
    (res.trialStarted
      ? chalk.yellow(
          "You're over the free plan usage limit, \n" +
            'and are now on a free 14-day premium trial.\n' +
            'View plans here: ' +
            manageUrl +
            '\n\n',
        )
      : '');

  return options.json
    ? JSON.stringify(
        _.assign({}, res, {
          manageUrl,
          packageManager,
        }),
      )
    : strOutput;
}
