module.exports = loadModules;

// Dependency types.
// We don't call out all of them, only the ones relevant to our behavior.
// extraneous means not found in package.json files, prod means not dev ATM
var DEP_TYPE_EXTRANEOUS = 'extraneous';
var DEP_TYPE_PROD = 'prod';
var DEP_TYPE_DEV = 'dev';


var fs = require('then-fs');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var path = require('path');
var semver = require('semver');
var tryRequire = require('./try-require');
var config = require('./config');

// FIXME only supports dependancies, not dev deps or opt-deps
function loadModules(root, callback) {
  return loadModulesInternal(root, null, callback);
}
function loadModulesInternal(root, rootDepType, callback) {
  if (typeof root === 'function') {
    callback = root;
    root = process.cwd();
  }
  if (!rootDepType) {
    rootDepType = DEP_TYPE_EXTRANEOUS;
  }

  if (typeof root !== 'string') {
    throw new Error('module path must be a string');
  }

  var modules = {};
  var promise = Promise.resolve().then(function () {
    // 1. read package.json for written deps
    var pkg = tryRequire(path.resolve(root, 'package.json'));

    // if there's a package found, collect this information too
    if (pkg) {
      modules = {
        name: pkg.name,
        version: pkg.version || null,
        license: pkg.license,
        depType: rootDepType,
        full: pkg.name + '@' + (pkg.version || '0.0.0'),
      };
    } else {
      // FIXME this is no place for a console.log.
      // http://media.giphy.com/media/njYrp176NQsHS/giphy.gif
      console.log('failed to load pgk on %s', root);
    }
    modules.dependencies = {};

    // 2. check actual installed deps
    return fs.readdir(path.resolve(root, 'node_modules')).then(function (dirs) {
      dirs.map(function (dir) {
        dir = path.resolve(root, 'node_modules', dir, 'package.json');
        return tryRequire(dir);
      })
      .filter(Boolean)
      .reduce(function (acc, curr) {
        var license;
        var licenses = curr.license || curr.licenses;

        if (Array.isArray(licenses)) {
          license = licenses.reduce(function (acc, curr) {
            acc.push((curr || {}).type || curr);
            return acc;
          }, []).join('/');
        } else {
          license = (licenses || {}).type || licenses;
        }

        var depType = rootDepType;
        if (depType !== DEP_TYPE_DEV) {
          if (pkg.dependencies[curr.name]) {
            depType = DEP_TYPE_PROD;
          } else if (pkg.devDependencies[curr.name]) {
            depType = DEP_TYPE_DEV;
          }
        }
        // By default include all modules, but optionally skip devDeps
        if (depType === DEP_TYPE_DEV &&
           config.devDeps && config.devDeps === 'false') {
          return acc;
        }

        acc[curr.name] = {
          name: curr.name,
          version: curr.version || null,
          full: curr.name + '@' + (curr.version || '0.0.0'),
          valid: semver.satisfies(curr.version, pkg.dependencies[curr.name]),
          devDependencies: curr.devDependencies,
          depType: depType,
          license: license || 'none',
          dep: pkg.dependencies[curr.name] || null,
        };
        return acc;
      }, modules.dependencies);

      return modules;
    }).then(function (modules) {

      var deps = Object.keys(modules.dependencies);

      if (deps.length === 0) {
        modules.dependencies = false;
        return modules;
      }

      var promises = deps.map(function (dep) {
        var depType = modules.dependencies[dep].depType;
        return loadModulesInternal(path.resolve(root, 'node_modules', dep), depType);
      });

      return Promise.all(promises).then(function (res) {
        res.forEach(function (mod) {
          // console.log(modules.dependencies[mod.name], mod.name, mod);
          modules.dependencies[mod.name].dependencies = mod.dependencies;
        });

        return modules;
      });
    }).catch(function (error) {
      // TODO decide whether it's okay that we keep throwing errors
      // will this process get faster without it? (possibly...)
      if (error.code === 'ENOENT') {
        // there's no node_modules directory, that's fine, there's no deps
        modules.dependencies = false;
        return modules;
      }
      throw error;
    });
  });

  if (callback) {
    promise.then(function (res) {
      callback(null, res);
    }).catch(callback);
  }

  return promise;
}
