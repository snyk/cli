import { DepTree } from '../types';

export function dropEmptyDeps(depTree: DepTree) {
  if (depTree.dependencies) {
    const keys = Object.keys(depTree.dependencies);
    if (keys.length === 0) {
      delete depTree.dependencies;
    } else {
      for (const k of keys) {
        dropEmptyDeps(depTree.dependencies[k]);
      }
    }
  }
  return depTree;
}
