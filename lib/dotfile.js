var yaml = require('js-yaml');
var fs = require('then-fs');
var path = require('path');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var spinner = require('./spinner');

module.exports = {
  load: load,
  save: save,
  getByVuln: getByVuln,
};

var defaultVersion = 'v1';
var latestParser = function (d) { return d; };

// this is a function to allow our tests and fixtures to change cwd
function defaultFilename() {
  return path.resolve(process.cwd(), '.snyk');
}

// eventually we'll have v2 which will point to latestParser, and v1 will
// need to process the old form of data and upgrade it to v2 structure
var parsers = {
  v1: latestParser,
};

function parse(data) {
  if (!data) {
    data = {};
  }

  if (!data.version) {
    data.version = defaultVersion;
  }

  if (!parsers[data.version]) {
    data.version = defaultVersion;
  }

  return parsers[data.version](data);
}

function load(root, options) {
  if (typeof root === 'object') {
    options = root;
    root = null;
  }

  if (!options) {
    options = {};
  }

  if (options['ignore-policy']) {
    return Promise.resolve({});
  }

  var filename = root ? path.resolve(root, '.snyk') : defaultFilename();

  return fs.readFile(filename, 'utf8').then(function (yamlContent) {
    return parse(yaml.safeLoad(yamlContent));
  });
}

function save(object, root) {
  var filename = root ?
    path.resolve(root, '.snyk') :
    defaultFilename();

  var lbl = 'Creating .snyk policy file...';

  return spinner(lbl).then(function () {
    object.version = defaultVersion;
    return yaml.safeDump(object);
  }).then(function (yaml) {
    return fs.writeFile(filename, yaml);
  }).then(spinner.clear(lbl));
}

function getByVuln(policy, id) {
  var match = {
    type: 'unknown',
    id: id,
    rules: [],
  };

  ['ignore', 'patch'].forEach(function (key) {
    console.log(typeof policy[key]);
    if (policy[key]) {
      Object.keys(policy[key]).forEach(function (p) {
        if (p === id) {
          match.type = key;
          match.rules = policy[key][p].slice(0);
        }
      });
    }
  });

  return match;
}