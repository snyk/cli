const flatten = require('lodash.flatten');
import { PackageExpanded } from 'snyk-resolve-deps/dist/types';

export function pluckPolicies(pkg: PackageExpanded): string[] | string {
  if (!pkg) {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: broken type
  if (pkg.snyk) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: broken type
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return [];
  }

  return flatten(
    Object.keys(pkg.dependencies)
      .map((name: string) => pluckPolicies(pkg.dependencies[name]))
      .filter(Boolean),
  );
}
