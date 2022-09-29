import { DepGraph } from '@snyk/dep-graph';

export function hasUnknownVersions(depGraph?: DepGraph): boolean {
  if (!depGraph) {
    return false;
  }
  for (const pkg of depGraph.getPkgs()) {
    if (pkg.version === 'unknown') {
      return true;
    }
  }
  return false;
}
