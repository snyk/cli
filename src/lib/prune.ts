import _debug from 'debug';
import { DepGraph, legacy } from '@snyk/dep-graph';

import { DepTree } from './types';
import config from './config';
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
  analytics.add('prePrunedPathsCount', prePrunePathsCount);
  if (isDenseGraph || pruneIsRequired) {
    debug('Trying to prune the graph');
    const pruneStartTime = Date.now();
    const prunedTree = (await graphToDepTree(depGraph, packageManager, {
      deduplicateWithinTopLevelDeps: true,
    })) as DepTree;
    const graphToTreeEndTime = Date.now();
    analytics.add(
      'prune.graphToTreeDuration',
      graphToTreeEndTime - pruneStartTime,
    );
    const prunedGraph = await depTreeToGraph(prunedTree, packageManager);
    analytics.add('prune.treeToGraphDuration', Date.now() - graphToTreeEndTime);
    const postPrunePathsCount = countPathsToGraphRoot(prunedGraph);
    analytics.add('postPrunedPathsCount', postPrunePathsCount);
    debug('postPrunePathsCount' + postPrunePathsCount);
    if (postPrunePathsCount > config.MAX_PATH_COUNT) {
      debug('Too many paths to process the project');
      //TODO replace the throw below with TooManyPaths we do not calculate vuln paths there
      throw new TooManyVulnPaths();
    }
    return prunedGraph;
  }
  return depGraph;
}
