module.exports = tryRequire;

var fs = require('then-fs');
var path = require('path');
var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line

function tryRequire(filename) {
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

      // also try to find a .snyk policy file whilst we're at it
      var dir = path.dirname(filename);
      if (!pkg.snyk) {
        pkg.snyk = fs.existsSync(path.resolve(dir, '.snyk'));
      }
      if (pkg.snyk) {
        pkg.snyk = dir;
      }

      return pkg;
    });
}