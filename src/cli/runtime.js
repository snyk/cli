var semver = require('semver');
var MIN_RUNTIME = '4.0.0';
var SUPPORTED_RUNTIME_RANGE = '>= 4';

function isSupported(runtimeVersion) {
  return semver.gte(runtimeVersion, MIN_RUNTIME);
}

module.exports = {
  isSupported: isSupported,
  supportedRange: SUPPORTED_RUNTIME_RANGE,
};
