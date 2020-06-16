import * as _debug from 'debug';
import { DepGraph, legacy } from '@snyk/dep-graph';

import { DepTree } from './types';
import * as config from './config';
import { TooManyVulnPaths } from './errors';
import * as analytics from '../lib/analytics';
import { SupportedPackageManagers } from './package-managers';
import { countPathsToGraphRoot } from './utils';

const debug = _debug('snyk:prune');

const { depTreeToGraph, graphToDepTree } = legacy;

export async function pruneGraph(
  depGraph: DepGraph,
  packageManager: SupportedPackageManagers,
  pruneIsRequired = false,
): Promise<DepGraph> {
  const prePrunePathsCount = countPathsToGraphRoot(depGraph);
  const isDenseGraph = prePrunePathsCount > config.PRUNE_DEPS_THRESHOLD;

  debug('rootPkg', depGraph.rootPkg);
  debug('prePrunePathsCount: ' + prePrunePathsCount);
  debug('isDenseGraph', isDenseGraph);
  analytics.add('prePrunePathsCount', prePrunePathsCount);
  if (isDenseGraph || pruneIsRequired) {
    const prunedTree = (await graphToDepTree(depGraph, packageManager, {
      deduplicateWithinTopLevelDeps: true,
    })) as DepTree;
    const prunedGraph = await depTreeToGraph(prunedTree, packageManager);
    const postPrunePathsCount = countPathsToGraphRoot(prunedGraph);
    analytics.add('postPrunePathsCount', postPrunePathsCount);
    debug('postPrunePathsCount' + postPrunePathsCount);
    if (postPrunePathsCount > config.MAX_PATH_COUNT) {
      debug('Too many vulnerable paths to process the project');
      throw new TooManyVulnPaths();
    }
    return prunedGraph;
  }
  return depGraph;
}
