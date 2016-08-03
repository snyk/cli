module.exports = tryRequire;

var fs = require('then-fs');
var path = require('path');
var debug = require('debug')('snyk:resolve:try-require');
var cloneDeep = require('lodash.clonedeep');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var lru = require('lru-cache');
var options = { max: 100, maxAge: 1000 * 60 * 60 };
var cache = lru(options);

module.exports.cache = cache; // allows for a reset

function tryRequire(filename) {
  var cached = cache.get(filename);
  if (cached) {
    var res = cloneDeep(cached);
    /* istanbul ignore else */
    if (process.env.TAP) {
      res.__cached = true;
    }
    return Promise.resolve(res);
  }
  return fs.readFile(filename, 'utf8')
    .then(JSON.parse)
    .catch(function (e) {
      debug('tryRequire silently failing on %s', e.message);
      return null;
    })
    .then(function (pkg) {
      if (!pkg) {
        return pkg;
      }

      // fixes potential issues later on
      if (!pkg.devDependencies) {
        pkg.devDependencies = {};
      }

      if (!pkg.dependencies) {
        pkg.dependencies = {};
      }

      if (!pkg.name) {
        pkg.name = path.basename(path.dirname(filename));
      }

      pkg.__filename = filename;

      // test for npm-shrinkwrap and find a .snyk policy file whilst we're at it
      var dir = path.dirname(filename);
      var promises = [
        fs.stat(path.resolve(dir, '.snyk')).catch(pass),
        fs.stat(path.resolve(dir, 'npm-shrinkwrap.json')).catch(pass),
      ];

      return Promise.all(promises).then(function (res) {
        if (!pkg.snyk) {
          pkg.snyk = res[0].isFile();
        }
        if (pkg.snyk) {
          pkg.snyk = dir;
        }

        if (res[1].isFile()) {
          pkg.shrinkwrap = true;
        }

        return pkg;
      });
    })
    .then(function (pkg) {
      cache.set(filename, pkg);
      return cloneDeep(pkg);
    });
}

var pass = function () {
  return {
    isFile: function () { return false; },
  };
};

/* istanbul ignore if */
if (!module.parent) {
  tryRequire(process.argv[2])
    .then(JSON.stringify)
    .then(console.log)
    .catch(console.log);
}