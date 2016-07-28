var path = require('path');
var cloneDeep = require('lodash.clonedeep');
var semver = require('semver');
var yaml = require('js-yaml');

module.exports = {
  import: imports,
  export: exports,
  demunge: require('./demunge'),
  version: version(),
};

var parsers = {
  v1: require('./v1'),
};

function imports(rawYaml) {
  var data = yaml.safeLoad(rawYaml || '');

  if (!data) {
    data = {};
  }

  if (!data.version) {
    data.version = version();
  }

  if (data.version === 'v1') {
    data.version = 'v1.0.0';
  }

  var parser = parsers['v' + semver.major(data.version.substr(1))];

  if (!parser) {
    throw new Error('unsupported version: ' + data.version);
  }

  return parser(data);
}

function exports(policy) {
  var data = cloneDeep(policy);

  // remove any private information on the policy
  Object.keys(data).map(function (key) {
    if (key.indexOf('__') === 0) {
      delete data[key];
    }

    if (data[key] == null) { // jshint ignore:line
      delete data[key];
    }

    // strip helper functions
    if (typeof data[key] === 'function') {
      delete data[key];
    }
  });

  // ensure we always update the version of the policy format
  data.version = version();
  return yaml.safeDump(data);
}

function version() {
  var filename = path.resolve(__dirname, '..', '..', 'package.json');
  var version = require(filename).version;

  if (version && version !== '0.0.0') {
    return 'v' + version;
  }

  return 'v1.0.0';
}
