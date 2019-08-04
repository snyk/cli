import * as _debug from 'debug';
import { DepGraph, legacy } from '@snyk/dep-graph';

import { DepTree } from './types';
import * as config from './config';
import { SupportedPackageManagers } from './package-managers';

const debug = _debug('snyk:prune');

const {depTreeToGraph, graphToDepTree} = legacy;

export function countPathsToGraphRoot(graph: DepGraph): number {
  return graph.getPkgs().reduce((acc, pkg) => acc + graph.countPathsToRoot(pkg), 0);
}

export async function pruneGraph(
  depGraph: DepGraph,
  packageManager: SupportedPackageManagers,
): Promise<DepGraph> {
  try {
    // Arbitrary threshold for maximum number of elements in the tree
    const threshold = config.PRUNE_DEPS_THRESHOLD;
    const prunedTree = (await graphToDepTree(
      depGraph,
      packageManager,
      { deduplicateWithinTopLevelDeps: true },
    )) as DepTree;

    const prunedGraph = await depTreeToGraph(prunedTree, packageManager);
    const count = countPathsToGraphRoot(prunedGraph);
    debug('prunedPathsCount: ' +  count);

    if (count < threshold) {
      return prunedGraph;
    }

    debug('Too many vulnerable paths to process the project');
    throw new Error('Too many vulnerable paths to process the project');
  } catch (e) {
    debug('Failed to prune the graph, returning original: ' + e);
    return depGraph;
  }
}
