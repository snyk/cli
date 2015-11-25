var yaml = require('js-yaml');
var fs = require('then-fs');
var path = require('path');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var spinner = require('../spinner');
var match = require('./match');
var parse = require('./parser');

module.exports = {
  load: load,
  save: save,
  getByVuln: match.getByVuln,
  matchToRule: match.matchToRule,
  display: require('./display'),
};

// this is a function to allow our tests and fixtures to change cwd
function defaultFilename() {
  return path.resolve(process.cwd(), '.snyk');
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

  var promises = [
    fs.readFile(filename, 'utf8'),
    fs.stat(filename),
  ];

  return Promise.all(promises).then(function (res) {
    var policy = parse(yaml.safeLoad(res[0]));

    policy.__filename = path.relative(process.cwd(), filename);
    policy.__modified = res[1].mtime;
    policy.__created = res[1].birthtime;

    return policy;
  });
}

function save(object, root) {
  var filename = root ?
    path.resolve(root, '.snyk') :
    defaultFilename();

  var lbl = 'Creating .snyk policy file...';

  return spinner(lbl).then(function () {
    object.version = parse.version;

    // remove any private information on the policy
    Object.keys(object).map(function (key) {
      if (key.indexOf('__') === 0) {
        delete object[key];
      }
    });
    return yaml.safeDump(object);
  }).then(function (yaml) {
    return fs.writeFile(filename, yaml);
  }).then(spinner.clear(lbl));
}