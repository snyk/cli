module.exports = patchesForPackage;

var semver = require('semver');

function patchesForPackage(vuln) {
  return vuln.patches.filter(function (patch) {
    if (semver.satisfies(vuln.version, patch.version)) {
      return (patch.urls || []).length ? patch : false;
    }
    return false;
  })[0] || null;
}
