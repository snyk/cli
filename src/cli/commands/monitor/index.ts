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
import {
  MonitorOptions,
  MonitorMeta,
  MonitorResult,
  PluginMetadata,
  Options,
} from '../../../lib/types';
import { MethodArgs, ArgsOptions } from '../../args';
import { maybePrintDeps } from '../../../lib/print-deps';
import * as analytics from '../../../lib/analytics';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { formatMonitorOutput } from './formatters/format-monitor-response';
import { processJsonMonitorResponse } from './process-json-monitor';
import { GoodResult, BadResult } from './types';
import { getDepsFromPlugin } from '../../../lib/plugins/get-deps-from-plugin';
import { extractPackageManager } from '../../../lib/plugins/extract-package-manager';
import { MultiProjectResultCustom } from '../../../lib/plugins/get-multi-plugin-result';
import { getSubProjectCount } from '../../../lib/plugins/get-sub-project-count';
import { convertSingleResultToMultiCustom } from '../../../lib/plugins/convert-single-splugin-res-to-multi-custom';
import { convertMultiResultToMultiCustom } from '../../../lib/plugins/convert-multi-plugin-res-to-multi-custom';

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
      const guessedPackageManager = detect.detectPackageManager(path, options);
      const analysisType =
        (options.docker ? 'docker' : guessedPackageManager) || 'all';

      const targetFile =
        !options.scanAllUnmanaged && options.docker && !options.file // snyk monitor --docker (without --file)
          ? undefined
          : options.file || detect.detectPackageFile(path);

      const displayPath = pathUtil.relative(
        '.',
        pathUtil.join(path, targetFile || ''),
      );

      const analyzingDepsSpinnerLabel =
        'Analyzing ' + analysisType + ' dependencies for ' + displayPath;

      await spinner(analyzingDepsSpinnerLabel);

      // Scan the project dependencies via a plugin

      analytics.add('pluginOptions', options);
      debug('getDepsFromPlugin ...');

      // each plugin will be asked to scan once per path
      // some return single InspectResult & newer ones return Multi
      const inspectResult = await promiseOrCleanup(
        getDepsFromPlugin(path, {
          ...options,
          path,
          packageManager: guessedPackageManager,
        }),
        spinner.clear(analyzingDepsSpinnerLabel),
      );

      analytics.add('pluginName', inspectResult.plugin.name);

      const postingMonitorSpinnerLabel =
        'Posting monitor snapshot for ' + displayPath + ' ...';
      await spinner(postingMonitorSpinnerLabel);

      // We send results from "all-sub-projects" scanning as different Monitor objects
      // multi result will become default, so start migrating code to always work with it
      let perProjectResult: MultiProjectResultCustom;
      let foundProjectCount;

      if (!pluginApi.isMultiResult(inspectResult)) {
        foundProjectCount = getSubProjectCount(inspectResult);
        perProjectResult = convertSingleResultToMultiCustom(inspectResult);
      } else {
        perProjectResult = convertMultiResultToMultiCustom(inspectResult);
      }

      // Post the project dependencies to the Registry
      for (const projectDeps of perProjectResult.scannedProjects) {
        const packageManager = extractPackageManager(
          projectDeps,
          perProjectResult,
          options as MonitorOptions & Options,
        );
        analytics.add('packageManager', packageManager);
        maybePrintDeps(options, projectDeps.depTree);

        debug(`Processing ${projectDeps.depTree.name}...`);
        maybePrintDeps(options, projectDeps.depTree);
        // TODO: not always correct for multi scan,
        // targetFile needs to be derived from project scanned always
        // this is not yet used anywhere in the system to leaving for now
        const targetFileRelativePath = targetFile
          ? pathUtil.join(pathUtil.resolve(path), targetFile)
          : '';
        const res: MonitorResult = await promiseOrCleanup(
          snykMonitor(
            path,
            generateMonitorMeta(options, packageManager),
            projectDeps,
            options,
            perProjectResult.plugin as PluginMetadata,
            targetFileRelativePath,
          ),
          spinner.clear(postingMonitorSpinnerLabel),
        );

        res.path = path;
        const projectName = projectDeps.depTree.name;

        const monOutput = formatMonitorOutput(
          packageManager,
          res,
          options,
          projectName,
          getSubProjectCount(inspectResult),
        );
        results.push({ ok: true, data: monOutput, path, projectName });
      }
      // push a good result
    } catch (err) {
      // push this error, the loop continues
      results.push({ ok: false, data: err, path });
    } finally {
      spinner.clearAll();
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

function generateMonitorMeta(options, packageManager?): MonitorMeta {
  return {
    method: 'cli',
    packageManager,
    'policy-path': options['policy-path'],
    'project-name': options['project-name'] || config.PROJECT_NAME,
    isDocker: !!options.docker,
    prune: !!options['prune-repeated-subdependencies'],
    'experimental-dep-graph': !!options['experimental-dep-graph'],
    'remote-repo-url': options['remote-repo-url'],
  };
}

async function validateMonitorPath(path, isDocker) {
  const exists = await fs.exists(path);
  if (!exists && !isDocker) {
    throw new Error('"' + path + '" is not a valid path for "snyk monitor"');
  }
}
