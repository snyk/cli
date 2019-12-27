import { DepTree } from '../types';

export function countTotalDependenciesInTree(depTree: DepTree): number {
  let count = 0;
  if (depTree.dependencies) {
    for (const name of Object.keys(depTree.dependencies)) {
      const dep = depTree.dependencies[name];
      if (dep) {
        count += 1 + countTotalDependenciesInTree(dep);
      }
    }
  }
  return count;
}
