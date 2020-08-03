module.exports = stripVersions;

const { parsePackageString: moduleToObject } = require('snyk-module');

function stripVersions(packages) {
  return packages.map((pkg) => moduleToObject(pkg).name);
}
