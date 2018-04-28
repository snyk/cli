var semver = require('semver');
var SUPPORTED_RUNTIME_RANGE = '>= 4';

function isSupported(runtimeVersion) {
  return semver.satisfies(runtimeVersion, SUPPORTED_RUNTIME_RANGE);
}

module.exports = {
  isSupported: isSupported,
  supportedRange: SUPPORTED_RUNTIME_RANGE,
};
