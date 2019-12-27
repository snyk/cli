import { DepTree } from '../types';

interface FilteredDepTree {
  filteredDepTree: DepTree;
  missingDeps: string[];
}

export function filterOutMissingDeps(depTree: DepTree): FilteredDepTree {
  const filteredDeps = {};
  const missingDeps: string[] = [];

  if (!depTree.dependencies) {
    return {
      filteredDepTree: depTree,
      missingDeps,
    };
  }

  for (const depKey of Object.keys(depTree.dependencies)) {
    const dep = depTree.dependencies[depKey];
    if (
      (dep as any).missingLockFileEntry ||
      ((dep as any).labels && (dep as any).labels.missingLockFileEntry)
    ) {
      // TODO(kyegupov): add field to the type
      missingDeps.push(`${dep.name}@${dep.version}`);
    } else {
      filteredDeps[depKey] = dep;
    }
  }
  const filteredDepTree: DepTree = {
    ...depTree,
    dependencies: filteredDeps,
  };

  return {
    filteredDepTree,
    missingDeps,
  };
}
