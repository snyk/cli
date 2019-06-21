module.exports = patchesForPackage;

const semver = require('semver');

function patchesForPackage(vuln) {
  return vuln.patches.filter((patch) => {
    if (semver.satisfies(vuln.version, patch.version)) {
      return (patch.urls || []).length ? patch : false;
    }
    return false;
  })[0] || null;
}
