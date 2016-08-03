module.exports = stripVersions;

var moduleToObject = require('snyk-module');

function stripVersions(packages) {
  return packages.map(function (pkg) {
    return moduleToObject(pkg).name;
  });
}