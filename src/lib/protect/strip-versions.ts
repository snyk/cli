export = stripVersions;

import { parsePackageString as moduleToObject } from 'snyk-module';

function stripVersions(packages) {
  return packages.map((pkg) => {
    return moduleToObject(pkg).name;
  });
}
