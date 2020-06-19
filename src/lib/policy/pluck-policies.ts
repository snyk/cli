import * as _ from '@snyk/lodash';
import { PackageExpanded } from 'snyk-resolve-deps';

export function pluckPolicies(pkg: PackageExpanded): string[] | string {
  if (!pkg) {
    return [];
  }

  if (pkg.snyk) {
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return [];
  }

  return _.flatten(
    Object.keys(pkg.dependencies)
      .map((name: string) => pluckPolicies(pkg.dependencies[name]))
      .filter(Boolean),
  );
}
