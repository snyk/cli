import * as _ from '@snyk/lodash';
import { PackageJson } from '../types';

export function pluckPolicies(pkg: PackageJson): string[] {
  if (!pkg) {
    return [];
  }

  if (pkg.snyk) {
    return []; // why is this check here?
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
