var fs = require('then-fs');
var path = require('path');
var debug = require('debug')('snyk:policy');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var match = require('./match');
var parse = require('./parser');
var tryRequire = require('snyk-try-require');
var filter = require('./filter');
var add = require('./add');

module.exports = {
  filter: filter,
  demunge: parse.demunge,
  load: load,
  save: save,
  getByVuln: match.getByVuln,
  matchToRule: match.matchToRule,
  loadFromText: loadFromText,
  add: add,
  create: create,
};

function create() {
  return loadFromText('');
}

// this is a function to allow our tests and fixtures to change cwd
function defaultFilename() {
  return path.resolve(process.cwd(), '.snyk');
}

function attachMethods(policy) {
  policy.filter = function (vulns, root) {
    return filter(vulns, policy, root || path.dirname(policy.__filename));
  };
  policy.save = save.bind(null, policy);
  policy.toString = parse.export.bind(null, policy);
  policy.demunge = parse.demunge.bind(null, policy);
  policy.add = add.bind(null, policy);
  policy.addIgnore = add.bind(null, policy, 'ignore');
  policy.addPatch = add.bind(null, policy, 'patch');
  return policy;
}

function loadFromText(text) {
  return new Promise(function (resolve) {
    var policy = parse.import(text);
    var now = Date.now();

    policy.__filename = '';
    policy.__modified = now;
    policy.__created = now;

    resolve(policy);
  }).then(attachMethods);
}

function load(root, options) {
  if (!Array.isArray(root) && typeof root !== 'string') {
    options = root;
    root = null;
  }

  if (!root) {
    root = process.cwd();
  }

  if (!options) {
    options = {};
  }

  var ignorePolicy = !!options['ignore-policy'];

  var filename = '';
  if (Array.isArray(root)) {
    // we do a bit of a dance to get the first item in the array, and
    // use it as our filename
    filename = root[0];
  } else {
    if (root.indexOf('.snyk') === -1) {
      root = path.resolve(root, '.snyk');
    }
    filename = root;
  }

  if (filename.indexOf('.snyk') === -1) {
    filename = path.resolve(filename, '.snyk');
  }

  var promise = new Promise(function (resolve) {
    if (ignorePolicy) {
      return resolve(parse.import());
    }

    if (!ignorePolicy && Array.isArray(root)) {
      return resolve(mergePolicies(root, options).then(function (res) {
        debug('final policy:');
        debug(JSON.stringify(res, '', 2));
        return res;
      }));
    }

    resolve(fs.readFile(filename, 'utf8').then(parse.import));
  });

  var promises = [
    promise,
    fs.stat(filename).catch(function () {
      return {};
    }),
  ];

  return Promise.all(promises).catch(function (error) {
    if (options.loose && error.code === 'ENOENT') {
      debug('ENOENT on file, but running loose');
      return [parse.import(), {}];
    }

    throw error;
  }).then(function (res) {
    var policy = res[0];

    policy.__modified = res[1].mtime;
    policy.__created = res[1].birthtime || res[1].ctime;

    if (options.loose && !policy.__modified) {
      policy.__filename = null;
    } else {
      policy.__filename = path.relative(process.cwd(), filename);
    }

    return policy;
  }).then(attachMethods);
}

function mergePolicies(policyDirs, options) {
  var ignoreTarget = options['trust-policies'] ? 'ignore' : 'suggest';

  return Promise.all(policyDirs.map(function (dir) {
    return load(dir, options);
  })).then(function (policies) {
    // firstly extend the paths in the ignore and patch
    var rootPolicy = policies[0];
    var others = policies.slice(1);

    return Promise.all(others.filter(function (policy) {
      return policy.__filename; // filter out non loaded policies
    }).map(function (policy) {
      var filename = path.dirname(policy.__filename) + '/package.json';

      return tryRequire(filename).then(function (pkg) {
        var full = pkg.name + '@' + pkg.version;

        mergePath('ignore', ignoreTarget, full, rootPolicy, policy);
        mergePath('patch', 'patch', full, rootPolicy, policy);
      });
    })).then(function () {
      return rootPolicy;
    });
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
    rootPolicy[into][id] = rootPolicy[into][id].concat(policy[type][id]);
  });
}

function save(object, root, spinner) {
  var filename = root ?
    path.resolve(root, '.snyk') :
    defaultFilename();

  var lbl = 'Saving .snyk policy file...';

  if (!spinner) {
    spinner = function (res) {
      return Promise.resolve(res);
    };
    spinner.clear = spinner;
  }

  return spinner(lbl).then(function () {
    return parse.export(object);
  }).then(function (yaml) {
    return fs.writeFile(filename, yaml);
  }).then(spinner.clear(lbl));
}

/* istanbul ignore if */
if (!module.parent) {
  load(process.argv[2]).then(function (res) {
    console.log(JSON.stringify(res, '', 2));
  }).catch(function (e) {
    console.log(e.stack);
  });
}
