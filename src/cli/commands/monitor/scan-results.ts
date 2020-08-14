import { ScanResponse } from 'snyk-docker-plugin';
import * as config from '../../../lib/config';
import { MonitorResult, MonitorMeta, Contributors } from '../../../lib/types';
import { monitor as snykMonitor } from '../../../lib/monitor';

import analytics = require('../../../lib/analytics');
import * as pathUtil from 'path';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import { formatMonitorOutput } from './formatters/format-monitor-response';
import { getExtraProjectCount } from '../../../lib/plugins/get-extra-project-count';
import * as spinner from '../../../lib/spinner';
import { GoodResult, BadResult } from './types';

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

export async function processScanResults(
  inspectResult: ScanResponse,
  path: string,
  results: Array<GoodResult | BadResult>,
  options: any,
  contributors: Contributors[],
): Promise<string> {
  for (const projectDeps of inspectResult.scanResults) {
    try {
      const extractedPackageManager = projectDeps.artifacts.find(
        (artifact) => artifact.meta?.packageManager !== undefined,
      )?.meta?.packageManager;

      analytics.add('packageManager', extractedPackageManager);

      const projectName: string | undefined =
        projectDeps.artifacts.find((artifact) => artifact.type === 'depTree')
          ?.data?.name ||
        projectDeps.artifacts.find(
          (artifact) => (artifact.type as any) === 'depGraph',
        )?.data?.rootPkg.name ||
        undefined;

      const tFile = projectDeps.artifacts.find(
        (artifact) => artifact.meta?.targetFile !== undefined,
      )?.meta?.targetFile;
      const targetFileRelativePath =
        (tFile && pathUtil.join(pathUtil.resolve(path), tFile)) || '';

      const displayPath = pathUtil.relative(
        '.',
        pathUtil.join(path, tFile || ''),
      );
      const postingMonitorSpinnerLabel =
        'Posting monitor snapshot for ' + displayPath + ' ...';

      const res: MonitorResult = await promiseOrCleanup(
        snykMonitor(
          path,
          generateMonitorMeta(options, extractedPackageManager),
          projectDeps,
          options,
          inspectResult.plugin as PluginMetadata,
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
        await getExtraProjectCount(path, options, inspectResult as any),
      );
      // push a good result
      results.push({ ok: true, data: monOutput, path, projectName });
    } catch (err) {
      // pushing this error allow this inner loop to keep scanning the projects
      // even if 1 in 100 fails
      results.push({ ok: false, data: err, path });
    }
  }
  return await Promise.resolve(inspectResult.toString());
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
