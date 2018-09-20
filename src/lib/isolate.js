module.exports = isolate;
module.exports.okay = okay;

var snyk = require('..');
var semver = require('semver');
var fs = require('fs');

var modules = {};
var potentialBlacklist = {};

function isolate(options) {
  if (!options) {
    options = {};
  }

  if (Array.isArray(options.isolate)) {
    potentialBlacklist = options.isolate.map(function (pkg) {
      var i = pkg.lastIndexOf('@');
      return {
        name: pkg.slice(0, i),
        version: pkg.slice(i + 1),
      };
    }).reduce(function (acc, curr) {
      acc[curr.name] = curr;
      return acc;
    }, {});
  }

  snyk.bus.on('after:module', function (module) {
    instrumentProps(module.id, module.id, module.exports);
  });
}



function instrumentProps(id, key, obj) {
  // only apply once
  if (obj.__snyked) {
    return obj;
  }

  obj.__snyked = true;
  var type = typeof obj;
  var original = obj;

  if (type === 'function') {
    obj = function instrumented() {
      console.log('NOTIFY: %s@%s', key || id, id);
      // snyk.notify(key, id);
      original.apply(this, arguments);
    };
  }

  if (type === 'object' || type === 'function') {
    Object.keys(original).forEach(function (key) {
      var prop = original[key];
      if (key === '__snyked') {
        return;
      }
      obj[key] = instrumentProps(id, key, prop);
    });
  }

  console.log('instrumented %s@%s', key, id.split('/').pop());

  return obj;
}

function okay(filename) {
  return !checkIsolation(filename);
}

function checkIsolation(filename) {
  var parts = filename.split('node_modules/');
  var module = parts.slice(-1)[0].split('/')[0];
  if (!modules[module] && module) {
    modules[module] = true;

    var check = potentialBlacklist[module];

    if (check) {
      var pkgFilename = filename.split(module)[0];
      var pkg = fs.readFileSync(pkgFilename + module + '/package.json');
      var version;
      try {
        version = JSON.parse(pkg).version;
      } catch (e) {}
      if (version) {
        if (semver.satisfies(version, check.version)) {
          throw new Error('Snyk: Isolated module "' + check.name +
            '@' + check.version + '" was not allowed to load');
        }
      }
    }

  }

  // lookup the version

  return false;
}
