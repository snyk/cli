module.exports = loadModules;

var depTypes = require('./dep-types');
var fs = require('then-fs');
var _ = require('lodash');
var debug = require('debug')('snyk:resolve:deps');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var path = require('path');
var semver = require('semver');
var resolve = require('snyk-resolve');
var tryRequire = require('snyk-try-require');

// FIXME only supports dependancies & dev deps not opt-deps
function loadModules(root, depType) {
  tryRequire.cache.reset(); // reset the package cache on re-run
  return loadModulesInternal(root, depType || null).then(function (tree) {
    // ensure there's no missing packages our known root deps
    var missing = [];
    if (tree.__dependencies) {
      Object.keys(tree.__dependencies).forEach(function (name) {
        if (!tree.dependencies[name]) {
          missing.push(resolve(name, root).then(function (dir) {
            return loadModulesInternal(dir, depTypes.PROD, {
              __from: [tree.name + '@' + tree.version, name],
            });
          }).catch(function (e) {
            if (e.code === 'NO_PACKAGE_FOUND') {
              return false;
            }
          }));
        }
      });
    }

    if (missing.length) {
      return Promise.all(missing).then(function (packages) {
        packages.filter(Boolean).forEach(function (pkg) {
          pkg.dep = tree.__dependencies[pkg.name];
          tree.dependencies[pkg.name] = pkg;
        });
        return tree;
      });
    }

    return tree;
  });

}

function loadModulesInternal(root, rootDepType, parent) {
  if (!rootDepType) {
    rootDepType = depTypes.EXTRANEOUS;
  }

  if (typeof root !== 'string') {
    return Promise.reject(new Error('module path must be a string'));
  }

  var modules = {};
  var dir = path.resolve(root, 'package.json');
  // 1. read package.json for written deps
  var promise = tryRequire(dir).then(function (pkg) {
    // if there's a package found, collect this information too
    if (pkg) {
      var full = pkg.name + '@' + (pkg.version || '0.0.0');
      modules = {
        name: pkg.name,
        version: pkg.version || null,
        license: pkg.license || 'none',
        depType: rootDepType,
        hasDevDependencies: !!pkg.devDependencies,
        full: full,
        __from: (parent || { __from: [] }).__from,
        __devDependencies: pkg.devDependencies,
        __dependencies: pkg.dependencies,
        __optionalDependencies: pkg.optionalDependencies,
        __bundleDependencies: pkg.bundleDependencies,
        __filename: pkg.__filename,
      };

      // allows us to add to work out the full path that the package was
      // introduced via
      pkg.__from = modules.__from.concat(full);
      pkg.full = modules.full;

      // flag and track where a shrinkwrapped package comes from
      if (!pkg.shrinkwrap && parent && parent.shrinkwrap) {
        pkg.shrinkwrap = parent.shrinkwrap;
      } else if (pkg.shrinkwrap) {
        pkg.shrinkwrap = pkg.full;
      }

      // this is a special case for the root package to get a consistent
      // __from path, so that the complete path (including it's own pkg name)
      if (modules.__from.length === 0) {
        modules.__from.push(full);
      }
    } else {
      throw new Error(dir + ' is not a node project');
    }
    modules.dependencies = {};

    // 2. check actual installed deps
    return fs.readdir(path.resolve(root, 'node_modules')).then(function (dirs) {
      var res = dirs.map(function (dir) {
        // completely ignore `.bin` npm helper dir
        if (dir === '.bin' || dir === '.DS_Store') {
          return null;
        }

        // this is a scoped namespace, and we'd expect to find directories
        // inside *this* `dir`, so treat differently
        if (dir.indexOf('@') === 0) {
          debug('scoped reset on %s', dir);
          dir = path.resolve(root, 'node_modules', dir);
          return fs.readdir(dir).then(function (dirs) {
            return Promise.all(dirs.map(function (scopedDir) {
              return tryRequire(path.resolve(dir, scopedDir, 'package.json'));
            }));
          });
        }

        // otherwise try to load a package.json from this node_module dir
        dir = path.resolve(root, 'node_modules', dir, 'package.json');
        return tryRequire(dir);
      });

      return Promise.all(res).then(function (res) {
        res = _.flatten(res).filter(Boolean);

        // if res.length === 0 we used to throw MISSING_NODE_MODULES but we're
        // not doing that now, and I think it's okay.

        res.reduce(function (acc, curr) {
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

          var depInfo = depTypes(curr.name, pkg);
          var depType = depInfo.type || rootDepType;
          var depFrom = depInfo.from;

          var valid = false;
          if (depFrom) {
            valid = semver.satisfies(curr.version, depFrom);
          }

          var full = curr.name + '@' + (curr.version || '0.0.0');

          acc[curr.name] = {
            name: curr.name,
            version: curr.version || null,
            full: full,
            valid: valid,
            depType: depType,
            snyk: curr.snyk,
            license: license || 'none',
            dep: depFrom || null,
            __from: pkg.__from.concat(full),
            __devDependencies: curr.devDependencies,
            __dependencies: curr.dependencies,
            __optionalDependencies: curr.optionalDependencies,
            __bundleDependencies: curr.bundleDependencies,
            __filename: curr.__filename,
          };

          if (depInfo.bundled) {
            acc[curr.name].bundled = acc[curr.name].__from.slice(0);
          }

          if (pkg.shrinkwrap) {
            acc[curr.name].shrinkwrap = pkg.shrinkwrap;
          }

          return acc;
        }, modules.dependencies);

        return modules;
      });
    }).then(function (modules) {
      var deps = Object.keys(modules.dependencies);

      var promises = deps.map(function (dep) {
        var depType = modules.dependencies[dep].depType;
        var dir = path.resolve(root, 'node_modules', dep);
        return loadModulesInternal(dir, depType, pkg);
      });

      return Promise.all(promises).then(function (res) {
        res.forEach(function (mod) {
          modules.dependencies[mod.name].dependencies = mod.dependencies;
        });

        return modules;
      });
    }).catch(function (error) {
      // TODO decide whether it's okay that we keep throwing errors
      // will this process get faster without it? (possibly...)
      /* istanbul ignore else  */
      if (error.code === 'ENOENT') {
        // there's no node_modules directory, that's fine, there's no deps
        modules.dependencies = {};
        return modules;
      }

      /* istanbul ignore next */
      throw error;
    });
  });

  return promise;
}