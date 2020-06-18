import * as _ from '@snyk/lodash';
import { DepTree } from '../types';
export function pluckPolicies(pkg: { snyk: boolean; dependencies: DepTree }) {
  if (!pkg) {
    return null;
  }

  if (pkg.snyk) {
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return null;
  }

  return _.flatten(
    Object.keys(pkg.dependencies)
      .map((name) => {
        return pluckPolicies(pkg.dependencies[name]);
      })
      .filter(Boolean),
  );
}
