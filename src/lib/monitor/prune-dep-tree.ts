import depGraphLib from '@snyk/dep-graph';
import { DepTree } from '../types';

export async function pruneTree(
  tree: DepTree,
  packageManagerName: string,
): Promise<DepTree> {
  // Pruning requires conversion to the graph first.
  // This is slow.
  const graph = await depGraphLib.legacy.depTreeToGraph(
    tree,
    packageManagerName,
  );
  const prunedTree: DepTree = (await depGraphLib.legacy.graphToDepTree(
    graph,
    packageManagerName,
    { deduplicateWithinTopLevelDeps: true },
  )) as DepTree;
  // Transplant pruned dependencies in the original tree (we want to keep all other fields):
  tree.dependencies = prunedTree.dependencies;
  return tree;
}
