import * as _debug from 'debug';
import { DepGraph, legacy, Pkg } from '@snyk/dep-graph';

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
    const prunedGraph = await dedupeGraph(depGraph, packageManager);

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

async function dedupeGraph(
  depGraph: DepGraph,
  packageManager: string,
): Promise<DepGraph> {
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
  return prunedGraph;
}

export interface VulnerablePkg {
  pkg: Pkg;
  issueCount: number;
}

const pkgKey = (pkg: Pkg) => `${pkg.name}@${pkg.version}`;

/**
 * True when the vulnerable paths, one output entry per path per issue, exceed
 * PRUNE_DEPS_THRESHOLD.
 */
export function vulnerablePathsExceedThreshold(
  depGraph: DepGraph,
  vulnerablePkgs: VulnerablePkg[],
): boolean {
  const graphPkgKeys = new Set(depGraph.getPkgs().map(pkgKey));
  let remaining = config.PRUNE_DEPS_THRESHOLD;
  for (const { pkg, issueCount } of vulnerablePkgs) {
    if (issueCount === 0 || !graphPkgKeys.has(pkgKey(pkg))) {
      continue;
    }
    const limit = Math.ceil((remaining + 1) / issueCount);
    remaining -= depGraph.countPathsToRoot(pkg, { limit }) * issueCount;
    if (remaining < 0) {
      return true;
    }
  }
  return false;
}

/**
 * Dedupes a test result graph within top-level dependencies, as `snyk test`
 * does, before vulnerable paths are expanded. Never fails the test: it
 * returns the original graph when converting to a tree would lose a
 * dependency, or when pruning throws.
 */
export async function pruneVulnerablePathsGraph(
  depGraph: DepGraph,
  packageManager: string,
): Promise<DepGraph> {
  try {
    if (hasSameNameSiblings(depGraph)) {
      // A dep tree keys children by name, so one version would be dropped.
      debug('Same-name siblings in the graph, using the unpruned graph');
      return depGraph;
    }
    const prunedGraph = await dedupeGraph(depGraph, packageManager);
    const prunedKeys = new Set(prunedGraph.getDepPkgs().map(pkgKey));
    const lostPkg = depGraph
      .getDepPkgs()
      .find((pkg) => !prunedKeys.has(pkgKey(pkg)));
    if (lostPkg) {
      debug(`Pruning dropped ${pkgKey(lostPkg)}, using the unpruned graph`);
      return depGraph;
    }
    return prunedGraph;
  } catch (err) {
    debug('Pruning failed, using the unpruned graph', err);
    return depGraph;
  }
}

function hasSameNameSiblings(depGraph: DepGraph): boolean {
  const { pkgs, graph } = depGraph.toJSON();
  const nameByPkgId = new Map(pkgs.map((pkg) => [pkg.id, pkg.info.name]));
  const pkgIdByNodeId = new Map(
    graph.nodes.map((node) => [node.nodeId, node.pkgId]),
  );
  return graph.nodes.some((node) => {
    const names = node.deps.map((dep) =>
      nameByPkgId.get(pkgIdByNodeId.get(dep.nodeId) as string),
    );
    return new Set(names).size !== names.length;
  });
}
