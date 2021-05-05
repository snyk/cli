export = monitor;

import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import chalk from 'chalk';
import * as Debug from 'debug';
import * as fs from 'fs';
import * as pathUtil from 'path';
import * as analytics from '../../../lib/analytics';
import { apiTokenExists } from '../../../lib/api-token';
import * as config from '../../../lib/config';
import * as detect from '../../../lib/detect';
import { getEcosystem, monitorEcosystem } from '../../../lib/ecosystems';
import { getFormattedMonitorOutput } from '../../../lib/ecosystems/monitor';
import { FailedToRunTestError, MonitorError } from '../../../lib/errors';
import { isMultiProjectScan } from '../../../lib/is-multi-project-scan';
import { monitor as snykMonitor } from '../../../lib/monitor';
import { getContributors } from '../../../lib/monitor/dev-count-analysis';
import { validateOptions } from '../../../lib/options-validator';
import { convertMultiResultToMultiCustom } from '../../../lib/plugins/convert-multi-plugin-res-to-multi-custom';
import { convertSingleResultToMultiCustom } from '../../../lib/plugins/convert-single-splugin-res-to-multi-custom';
import { extractPackageManager } from '../../../lib/plugins/extract-package-manager';
import { getDepsFromPlugin } from '../../../lib/plugins/get-deps-from-plugin';
import { getExtraProjectCount } from '../../../lib/plugins/get-extra-project-count';
import { MultiProjectResultCustom } from '../../../lib/plugins/get-multi-plugin-result';
import { maybePrintDepGraph, maybePrintDepTree } from '../../../lib/print-deps';
import * as spinner from '../../../lib/spinner';
import {
  Contributor,
  MonitorMeta,
  MonitorOptions,
  MonitorResult,
  Options,
} from '../../../lib/types';
import { MethodArgs } from '../../args';
import { processCommandArgs } from '../process-command-args';
import { formatMonitorOutput } from './formatters/format-monitor-response';
import { processJsonMonitorResponse } from './process-json-monitor';
import { BadResult, GoodResult } from './types';

import snyk = require('../../../lib'); // TODO(kyegupov): fix import

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
  const { options, paths } = processCommandArgs(...args0);
  const results: Array<GoodResult | BadResult> = [];

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

  let contributors: Contributor[] = [];
  if (!options.docker && analytics.allowAnalytics()) {
    try {
      contributors = await getContributors();
    } catch (err) {
      debug('error getting repo contributors', err);
    }
  }

  const ecosystem = getEcosystem(options);
  if (ecosystem) {
    const commandResult = await monitorEcosystem(ecosystem, paths, options);

    const [monitorResults, monitorErrors] = commandResult;

    return await getFormattedMonitorOutput(
      results,
      monitorResults,
      monitorErrors,
      options,
    );
  }

  // Part 1: every argument is a scan target; process them sequentially
  for (const path of paths) {
    debug(`Processing ${path}...`);
    try {
      validateMonitorPath(path, options.docker);
      let analysisType = 'all';
      let packageManager;
      if (isMultiProjectScan(options)) {
        analysisType = 'all';
      } else if (options.docker) {
        analysisType = 'docker';
      } else {
        packageManager = detect.detectPackageManager(path, options);
      }

      await validateOptions(
        options as Options & MonitorOptions,
        packageManager,
      );

      const targetFile =
        !options.scanAllUnmanaged && options.docker && !options.file // snyk monitor --docker (without --file)
          ? undefined
          : options.file || detect.detectPackageFile(path);

      const displayPath = pathUtil.relative(
        '.',
        pathUtil.join(path, targetFile || ''),
      );

      const analyzingDepsSpinnerLabel =
        'Analyzing ' +
        (packageManager ? packageManager : analysisType) +
        ' dependencies for ' +
        displayPath;

      await spinner(analyzingDepsSpinnerLabel);

      // Scan the project dependencies via a plugin
      debug('getDepsFromPlugin ...');

      // each plugin will be asked to scan once per path
      // some return single InspectResult & newer ones return Multi
      const inspectResult = await promiseOrCleanup(
        getDepsFromPlugin(path, {
          ...options,
          path,
          packageManager,
        }),
        spinner.clear(analyzingDepsSpinnerLabel),
      );
      analytics.add('pluginName', inspectResult.plugin.name);

      // We send results from "all-sub-projects" scanning as different Monitor objects
      // multi result will become default, so start migrating code to always work with it
      let perProjectResult: MultiProjectResultCustom;

      if (!pluginApi.isMultiResult(inspectResult)) {
        perProjectResult = convertSingleResultToMultiCustom(inspectResult);
      } else {
        perProjectResult = convertMultiResultToMultiCustom(inspectResult);
      }

      const failedResults = (inspectResult as MultiProjectResultCustom)
        .failedResults;
      if (failedResults?.length) {
        failedResults.forEach((result) => {
          results.push({
            ok: false,
            data: new MonitorError(500, result.errMessage),
            path: result.targetFile || '',
          });
        });
      }

      const postingMonitorSpinnerLabel =
        'Posting monitor snapshot for ' + displayPath + ' ...';
      await spinner(postingMonitorSpinnerLabel);

      // Post the project dependencies to the Registry
      for (const projectDeps of perProjectResult.scannedProjects) {
        try {
          if (!projectDeps.depGraph && !projectDeps.depTree) {
            debug(
              'scannedProject is missing depGraph or depTree, cannot run test/monitor',
            );
            throw new FailedToRunTestError(
              'Your monitor request could not be completed. Please email support@snyk.io',
            );
          }
          const extractedPackageManager = extractPackageManager(
            projectDeps,
            perProjectResult,
            options as MonitorOptions & Options,
          );

          analytics.add('packageManager', extractedPackageManager);

          const projectName = getProjectName(projectDeps);
          if (projectDeps.depGraph) {
            debug(`Processing ${projectDeps.depGraph.rootPkg?.name}...`);
            maybePrintDepGraph(options, projectDeps.depGraph);
          }

          if (projectDeps.depTree) {
            debug(`Processing ${projectDeps.depTree.name}...`);
            maybePrintDepTree(options, projectDeps.depTree);
          }

          const tFile = projectDeps.targetFile || targetFile;
          const targetFileRelativePath =
            projectDeps.plugin.targetFile ||
            (tFile && pathUtil.resolve(path, tFile)) ||
            '';

          const res: MonitorResult = await promiseOrCleanup(
            snykMonitor(
              path,
              generateMonitorMeta(options, extractedPackageManager),
              projectDeps,
              options,
              projectDeps.plugin as PluginMetadata,
              targetFileRelativePath,
              contributors,
            ),
            spinner.clear(postingMonitorSpinnerLabel),
          );

          res.path = path;
          const monOutput = formatMonitorOutput(
            extractedPackageManager,
            res,
            options,
            projectName,
            await getExtraProjectCount(path, options, inspectResult),
          );
          // push a good result
          results.push({ ok: true, data: monOutput, path, projectName });
        } catch (err) {
          // pushing this error allow this inner loop to keep scanning the projects
          // even if 1 in 100 fails
          results.push({ ok: false, data: err, path });
        }
      }
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
    prune: !!options.pruneRepeatedSubdependencies,
    'experimental-dep-graph': !!options['experimental-dep-graph'],
    'remote-repo-url': options['remote-repo-url'],
  };
}

function validateMonitorPath(path: string, isDocker?: boolean): void {
  const exists = fs.existsSync(path);
  if (!exists && !isDocker) {
    throw new Error('"' + path + '" is not a valid path for "snyk monitor"');
  }
}

function getProjectName(projectDeps): string {
  return (
    projectDeps.meta?.gradleProjectName ||
    projectDeps.depGraph?.rootPkg?.name ||
    projectDeps.depTree?.name
  );
}
