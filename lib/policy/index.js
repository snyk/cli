var yaml = require('js-yaml');
var fs = require('then-fs');
var path = require('path');
var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var spinner = require('../spinner');
var match = require('./match');
var parse = require('./parser');
var tryRequire = require('snyk-try-require');

module.exports = {
  load: load,
  save: save,
  getByVuln: match.getByVuln,
  matchToRule: match.matchToRule,
  display: require('./display'),
  loadFromText: loadFromText,
};

// this is a function to allow our tests and fixtures to change cwd
function defaultFilename() {
  return path.resolve(process.cwd(), '.snyk');
}

function loadFromText(text) {
  return new Promise(function (resolve) {
    var policy = parse(yaml.safeLoad(text));
    var now = Date.now();

    policy.__filename = '<from text>';
    policy.__modified = now;
    policy.__created = now;

    resolve(policy);
  });
}

function load(root, options) {
  if (!Array.isArray(root) && typeof root !== 'string') {
    options = root;
    root = null;
  }

  if (!options) {
    options = {};
  }

  if (options['ignore-policy']) {
    return Promise.resolve({});
  }

  if (Array.isArray(root)) {
    return mergePolicies(root, options).then(function (res) {
      debug('final policy:');
      debug(JSON.stringify(res, '', 2));
      return res;
    });
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
  }).catch(function (error) {
    if (options.loose && error.code === 'ENOENT') {
      return parse({});
    }

    throw error;
  });
}

function mergePolicies(policyDirs, options) {
  var ignoreTarget = options['trust-policies'] ? 'ignore' : 'suggest';

  return Promise.all(policyDirs.map(function (dir) {
    return load(dir, options);
  })).then(function (policies) {
    // firstly extend the paths in the ignore and patch
    var rootPolicy = policies[0];
    var others = policies.slice(1);

    return Promise.all(others.map(function (policy) {
      var filename = path.dirname(policy.__filename) + '/package.json';

      return tryRequire(filename).then(function (pkg) {
        var full = pkg.name + '@' + pkg.version;

        mergePath('ignore', ignoreTarget, full, rootPolicy, policy);
        mergePath('patch', 'patch', full, rootPolicy, policy);
      });
    })).then(function () {
      return rootPolicy;
    });
    // return policies[0];
  });
}

// note: mutates both objects, be warned!
function mergePath(type, into, pathRoot, rootPolicy, policy) {
  if (!rootPolicy[into]) {
    rootPolicy[into] = {};
  }
  Object.keys(policy[type]).forEach(function (id) {
    // convert the path from `module@version` to `parent > module@version`
    policy[type][id] = policy[type][id].map(function (path) {
      // this is because our policy file format favours "readable" yaml,
      // instead of easy to use object structures.
      var key = Object.keys(path).pop();
      var newPath = {};
      newPath[pathRoot + ' > ' + key] = path[key];
      path[key].from = pathRoot;
      return newPath;
    });

    // add the rule if we don't have it in our policy already
    if (!rootPolicy[into][id]) {
      rootPolicy[into][id] = policy[type][id];
      return;
    }

    // otherwise we need to merge up manually
    rootPolicy[into][id] = rootPolicy[type][id].concat(policy[type][id]);
  });
}

function save(object, root) {
  var filename = root ?
    path.resolve(root, '.snyk') :
    defaultFilename();

  var lbl = 'Saving .snyk policy file...';

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