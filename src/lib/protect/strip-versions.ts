import * as moduleToObject from 'snyk-module';

export function stripVersions(packages: string[]) {
  return packages.map((pkg) => moduleToObject(pkg).name);
}
