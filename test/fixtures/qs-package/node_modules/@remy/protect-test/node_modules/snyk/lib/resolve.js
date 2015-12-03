module.exports = resolve;

var fs = require('then-fs');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var path = require('path');

function resolve(module) {
  return Promise.resolve().then(function () {
    // allow module to be a package
    if (typeof module === 'object') {
      if (!module.name) {
        throw new Error('Watching packages requires a `name` property');
      }

      return module;
    } else if (typeof module !== 'string') {
      throw new Error('Expecting module name to be a string');
    }

    // if the string is a specific version
    if (module.indexOf('@') !== -1) {
      var pkg = {};
      // FIXME handle @private/module@1.0.x
      module.split('@').forEach(function (item, i) {
        if (i === 0) {
          pkg.name = item;
        } else {
          pkg.version = item;
        }
      });

      return pkg.name + '/' + pkg.version;
    }


    // else we need to test if it's a local path and read
    // the package off the disk, otherwise just send the
    // module.name@*
    return fs.stat(module).then(function (stat) {
      var filename;
      if (stat.isDirectory()) {
        // this is the more likely route
        filename = path.join(module, 'package.json');
      } else if (stat.isFile()) {
        // this will need to be package.json
        filename = module;
      } else {
        throw new Error('The file type for ' + module + ' is not supported');
      }

      return fs.readFile(filename, 'utf8').then(function (text) {
        return JSON.parse(text);
      });
    });
  }).catch(function (error) {
    // if the file doesn't exist, then we're asking for a specific
    // module name
    if (error.code === 'ENOENT') {
      return module;
    }

    throw error; // rethrow unexpected otherwise
  });
}