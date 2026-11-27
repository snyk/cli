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

/**
 * Prunes a test result graph before vulnerable paths are expanded, when the
 * paths to the vulnerable packages exceed PRUNE_DEPS_THRESHOLD (or pruning is
 * forced). Never fails the test: if pruning throws or loses a package, the
 * original graph is returned.
 */
export async function pruneVulnerablePathsGraph(
  depGraph: DepGraph,
  packageManager: string,
  vulnerablePkgs: { name: string; version?: string }[],
  pruneIsRequired = false,
): Promise<DepGraph> {
  if (
    !pruneIsRequired &&
    !exceedsVulnerablePathsThreshold(depGraph, vulnerablePkgs)
  ) {
    return depGraph;
  }

  try {
    const prunedTree = (await graphToDepTree(depGraph, packageManager, {
      deduplicateWithinTopLevelDeps: true,
    })) as DepTree;
    const prunedGraph = await depTreeToGraph(prunedTree, packageManager);

    const prunedPkgIds = new Set(
      prunedGraph.getPkgs().map((pkg) => `${pkg.name}@${pkg.version}`),
    );
    const lostPkg = depGraph
      .getPkgs()
      .find((pkg) => !prunedPkgIds.has(`${pkg.name}@${pkg.version}`));
    if (lostPkg) {
      debug(
        `Pruning dropped ${lostPkg.name}@${lostPkg.version}, using the unpruned graph`,
      );
      return depGraph;
    }
    return prunedGraph;
  } catch (err) {
    debug('Pruning failed, using the unpruned graph', err);
    return depGraph;
  }
}

function exceedsVulnerablePathsThreshold(
  depGraph: DepGraph,
  vulnerablePkgs: { name: string; version?: string }[],
): boolean {
  const graphPkgIds = new Set(
    depGraph.getPkgs().map((pkg) => `${pkg.name}@${pkg.version}`),
  );
  let remaining = config.PRUNE_DEPS_THRESHOLD;
  for (const pkg of vulnerablePkgs) {
    if (!graphPkgIds.has(`${pkg.name}@${pkg.version}`)) {
      continue;
    }
    remaining -= depGraph.countPathsToRoot(pkg, { limit: remaining + 1 });
    if (remaining < 0) {
      return true;
    }
  }
  return false;
}
