import * as Debug from 'debug';
import * as pathUtil from 'path';
import * as pMap from 'p-map';
import * as analytics from '../../../lib/analytics';
import { FailedToRunTestError } from '../../../lib/errors/failed-to-run-test-error';
import { extractPackageManager } from '../../../lib/plugins/extract-package-manager';
import { MultiProjectResultCustom } from '../../../lib/plugins/get-multi-plugin-result';
import { monitor as snykMonitor } from '../../../lib/monitor';
import { spinner } from '../../../lib/spinner';
import {
  Options,
  MonitorOptions,
  MonitorResult,
  Contributor,
} from '../../../lib/types';
import {
  generateMonitorMeta,
  getSCAProjectName,
  promiseOrCleanup,
} from './utils';
import { maybePrintDepGraph, maybePrintDepTree } from '../../../lib/print-deps';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import { generateProjectAttributes, generateTags } from '.';
import { BadResult, GoodResult } from './types';
import { formatMonitorOutput } from '../../../lib/formatters';
import { getExtraProjectCount } from '../../../lib/plugins/get-extra-project-count';

const debug = Debug('snyk');

export async function monitorProcessChunksCommand(
  path: string,
  inspectResult: MultiProjectResultCustom | pluginApi.MultiProjectResult,
  multiProjectResult: MultiProjectResultCustom,
  contributors: Contributor[],
  options: MonitorOptions & Options,
  targetFile?: string,
): Promise<Array<GoodResult | BadResult>> {
  const { scannedProjects } = multiProjectResult;

  const results: Array<GoodResult | BadResult> = [];
  const MAX_CONCURRENCY = 5;

  try {
    await pMap(
      scannedProjects,
      async (scannedProject) => {
        const { depGraph, depTree } = scannedProject;

        if (!depGraph && !depTree) {
          debug(
            'scannedProject is missing depGraph or depTree, cannot run test/monitor',
          );
          throw new FailedToRunTestError(
            'Your monitor request could not be completed. Please email support@snyk.io',
          );
        }

        const extractedPackageManager = extractPackageManager(
          scannedProject,
          multiProjectResult,
          options as MonitorOptions & Options,
        );

        analytics.add('packageManager', extractedPackageManager);

        const projectName = getSCAProjectName(scannedProject);

        if (depGraph) {
          debug(`Processing ${depGraph.rootPkg?.name}...`);
          maybePrintDepGraph(options, depGraph);
        }

        if (depTree) {
          debug(`Processing ${depTree.name}...`);
          maybePrintDepTree(options, depTree);
        }

        const tFile = scannedProject.targetFile || targetFile;
        const targetFileRelativePath =
          scannedProject.plugin.targetFile ||
          (tFile && pathUtil.join(pathUtil.resolve(path), tFile)) ||
          '';

        const displayPath = pathUtil.relative(
          '.',
          pathUtil.join(path, targetFile || ''),
        );

        const postingMonitorSpinnerLabel =
          'Posting monitor snapshot for ' + displayPath + ' ...';

        const res: MonitorResult = await promiseOrCleanup(
          snykMonitor(
            path,
            generateMonitorMeta(options, extractedPackageManager),
            scannedProject,
            options,
            scannedProject.plugin as PluginMetadata,
            targetFileRelativePath,
            contributors,
            generateProjectAttributes(options),
            generateTags(options),
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
      },
      { concurrency: MAX_CONCURRENCY },
    );
  } catch (err) {
    // pushing this error allow this inner loop to keep scanning the projects
    // even if 1 in 100 fails
    results.push({ ok: false, data: err, path });
  } finally {
    spinner.clearAll();
  }

  return results;
}
