module.exports = stripVersions;

const moduleToObject = require('snyk-module');

function stripVersions(packages) {
  return packages.map((pkg) => {
    return moduleToObject(pkg).name;
  });
}
