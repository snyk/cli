import * as _ from 'lodash';

export function pluckPolicies(pkg) {
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
