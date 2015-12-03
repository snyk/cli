var yaml = require('js-yaml');
var fs = require('then-fs');
var path = require('path');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var spinner = require('../spinner');
var match = require('./match');
var parse = require('./parser');
var tryRequire = require('../try-require');

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
    return mergePolicies(root, options);
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

function mergePolicies(policyDirs, options) {
  return Promise.all(policyDirs.map(function (dir) {
    return load(dir, options);
  })).then(function (policies) {
    // firstly extend the paths in the ignore and patch
    var rootPolicy = policies[0];
    var others = policies.slice(1);

    return Promise.all(others.map(function (policy, i) {
      var filename = path.dirname(policy.__filename) + '/package.json';

      return tryRequire(filename).then(function (pkg) {
        var full = pkg.name + '@' + pkg.version;

        mergePath('ignore', full, rootPolicy, policy);
        mergePath('patch', full, rootPolicy, policy);
      });
    })).then(function () {
      return rootPolicy;
    });
    // return policies[0];
  });
}

// note: mutates both objects, be warned!
function mergePath(type, pathRoot, rootPolicy, policy) {
  Object.keys(policy[type]).forEach(function (id) {
    // convert the path from `module@version` to `parent > module@version`
    policy[type][id] = policy[type][id].map(function (path) {
      // this nonsense is because our policy file format favours "readable"
      // yaml, instead of sensible object structures! user: 1, developer: 0
      var key = Object.keys(path).pop();
      var newPath = {};
      newPath[pathRoot + ' > ' + key] = path[key];
      return newPath;
    });

    // add the rule if we don't have it in our policy already
    if (!rootPolicy[type][id]) {
      rootPolicy[type][id] = policy[type][id];
      return;
    }

    // otherwise we need to merge up manually
    rootPolicy[type][id] = rootPolicy[type][id].concat(policy[type][id]);
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