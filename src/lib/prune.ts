import * as _debug from 'debug';
import { DepGraph, legacy } from '@snyk/dep-graph';

import { DepTree } from './types';
import config from './config';
import { TooManyVulnPaths } from './errors';
import * as analytics from '../lib/analytics';
import { SupportedPackageManagers } from './package-managers';

const debug = _debug('snyk:prune');

const { depTreeToGraph, graphToDepTree } = legacy;

export async function pruneGraph(
  depGraph: DepGraph,
  packageManager: SupportedPackageManagers,
  pruneIsRequired = false,
): Promise<DepGraph> {
  const prune = shouldPrune(depGraph, pruneIsRequired);

  debug('rootPkg', depGraph.rootPkg);
  debug('shouldPrune: ' + prune);
  if (prune) {
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

    const { completed: postPrunePathsCountCompleted } =
      countPathsToRootEarlyExit(prunedGraph, config.MAX_PATH_COUNT);

    if (!postPrunePathsCountCompleted) {
      debug('Too many paths to process the project');
      //TODO replace the throw below with TooManyPaths we do not calculate vuln paths there
      throw new TooManyVulnPaths();
    }
    return prunedGraph;
  }
  return depGraph;
}

function shouldPrune(depGraph: DepGraph, pruneIsRequired: boolean): boolean {
  // Short circuit is possible if this flag is set
  if (pruneIsRequired) {
    return true;
  }

  const { completed } = countPathsToRootEarlyExit(
    depGraph,
    config.PRUNE_DEPS_THRESHOLD,
  );

  return !completed;
}

function countPathsToRootEarlyExit(
  depGraph: DepGraph,
  limit: number,
): { count: number; completed: boolean } {
  let accumulatedPathCount = 0;
  for (const pkg of depGraph.getPkgs()) {
    accumulatedPathCount += depGraph.countPathsToRoot(pkg);

    if (accumulatedPathCount > limit) {
      return { completed: false, count: accumulatedPathCount };
    }
  }

  return { completed: true, count: accumulatedPathCount };
}
