export = monitor;

import * as _ from 'lodash';
import * as fs from 'then-fs';
import { apiTokenExists } from '../../../lib/api-token';
import snyk = require('../../../lib'); // TODO(kyegupov): fix import
import { monitor as snykMonitor } from '../../../lib/monitor';
import * as config from '../../../lib/config';
import chalk from 'chalk';
import * as pathUtil from 'path';
import * as spinner from '../../../lib/spinner';
import * as Debug from 'debug';

import * as detect from '../../../lib/detect';
import { MonitorOptions, MonitorMeta } from '../../../lib/types';
import { MethodArgs, ArgsOptions } from '../../args';
import { maybePrintDeps } from '../../../lib/print-deps';
import * as analytics from '../../../lib/analytics';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { formatMonitorOutput } from './formatters/format-monitor-response';
import { getSubProjectCount } from '../../../lib/plugins/get-sub-project-count';
import { processJsonMonitorResponse } from './process-json-monitor';
import { GoodResult, BadResult } from './types';
import { getDepsFromPlugin } from '../../../lib/plugins/get-deps-from-plugin';

const SEPARATOR = '\n-------------------------------------------------------\n';
const debug = Debug('snyk');

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

  // Part 1: every argument is a scan target; process them sequentially
  for (const path of args as string[]) {
    debug(`Processing ${path}...`);
    try {
      await validateMonitorPath(path, options.docker);

      let packageManager = detect.detectPackageManager(path, options);

      const targetFile =
        !options.scanAllUnmanaged && options.docker && !options.file // snyk monitor --docker (without --file)
          ? undefined
          : options.file || detect.detectPackageFile(path);

      const displayPath = pathUtil.relative(
        '.',
        pathUtil.join(path, targetFile || ''),
      );

      const analysisType = options.docker ? 'docker' : packageManager;

      const analyzingDepsSpinnerLabel =
        'Analyzing ' + analysisType + ' dependencies for ' + displayPath;

      await spinner(analyzingDepsSpinnerLabel);

      // Scan the project dependencies via a plugin

      analytics.add('packageManager', packageManager);
      analytics.add('pluginOptions', options);
      debug('getDepsFromPlugin ...');

      // each plugin will be asked to scan once per path
      // some return single InspectResult & newer ones return Multi
      const inspectResult = await promiseOrCleanup(
        getDepsFromPlugin(path, { ...options, path, packageManager }),
        spinner.clear(analyzingDepsSpinnerLabel),
      );

      analytics.add('pluginName', inspectResult.plugin.name);

      await spinner.clear(analyzingDepsSpinnerLabel)(inspectResult);

      const postingMonitorSpinnerLabel =
        'Posting monitor snapshot for ' + displayPath + ' ...';

      await spinner(postingMonitorSpinnerLabel);
      if (inspectResult.plugin.packageManager) {
        packageManager = inspectResult.plugin.packageManager;
      }
      const monitorMeta: MonitorMeta = {
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
      // multi result will become default, so start migrating code to always work with it
      let perProjectResult: pluginApi.MultiProjectResult;
      let foundProjectCount;

      if (!pluginApi.isMultiResult(inspectResult)) {
        foundProjectCount = getSubProjectCount(inspectResult);
        const { plugin, meta, package: depTree } = inspectResult;
        perProjectResult = {
          plugin,
          scannedProjects: [
            {
              depTree,
              meta,
            },
          ],
        };
      } else {
        perProjectResult = inspectResult;
      }

      // Post the project dependencies to the Registry
      for (const projectDeps of perProjectResult.scannedProjects) {
        debug(
          `Processing ${projectDeps.depTree.name || targetFile || path}...`,
        );
        maybePrintDeps(options, projectDeps.depTree);

        const res = await promiseOrCleanup(
          snykMonitor(
            path,
            monitorMeta,
            projectDeps,
            options,
            perProjectResult.plugin,
            targetFile,
          ),
          spinner.clear(postingMonitorSpinnerLabel),
        );

        await spinner.clear(postingMonitorSpinnerLabel)(res);

        res.path = path;
        const projectName = projectDeps.depTree.name;

        const monOutput = formatMonitorOutput(
          packageManager,
          res,
          options,
          projectName,
          foundProjectCount,
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
    return processJsonMonitorResponse(results);
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

async function validateMonitorPath(path, isDocker) {
  const exists = await fs.exists(path);
  if (!exists && !isDocker) {
    throw new Error('"' + path + '" is not a valid path for "snyk monitor"');
  }
}
