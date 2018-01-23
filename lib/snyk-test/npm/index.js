module.exports = test;

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('../../request');
var path = require('path');
var fs = require('then-fs');
var snyk = require('../..');
var spinner = require('../../spinner');
var moduleToObject = require('snyk-module');
var isCI = require('../../is-ci');
var _ = require('../../../dist/lodash-min');
var analytics = require('../../analytics');

// important: this is different from ./config (which is the *user's* config)
var config = require('../../config');

function test(root, options) {
  options.file = options.file || 'package.json';

  var promise = Promise.all([
    fs.exists(root),
    fs.exists(path.join(root, 'node_modules')),
  ]).then(function (res) {
    var exists = res[0];
    var nodeModulesExist = res[1];
    var hasDevDependencies = false;

    if (exists && !nodeModulesExist) {
      // throw a custom error
      throw new Error('Missing node_modules folder: we can\'t test ' +
        'without dependencies.\nPlease run `npm install` first.');
    }

    // if the file exists, let's read the package file and post
    // that up to the server.
    // if it doesn't, then we're assuming this is an existing
    // module on npm, so send the bare argument
    var payload = {
      // options.vulnEndpoint is only used for file system tests
      url: config.API + (options.vulnEndpoint || '/vuln/npm'),
      json: true,
      headers: {
        'x-is-ci': isCI,
        authorization: 'token ' + snyk.api,
      },
    };

    var p = Promise.resolve();
    var policyLocations = [options['policy-path'] || root];
    analytics.add('local', exists);
    var modules = null;
    if (exists) {
      p = snyk.modules(root, options).then(function (pkg) {
        modules = pkg;
        // if there's no package name, let's get it from the root dir
        if (!pkg.name) {
          pkg.name = path.basename(path.resolve(root));
        }
        policyLocations = policyLocations.concat(pluckPolicies(pkg));
        debug('policies found', policyLocations);
        analytics.add('policies', policyLocations.length);
        hasDevDependencies = pkg.hasDevDependencies;
        payload.method = 'POST';
        payload.body = pkg;
        if (options.org) {
          payload.qs = {org: options.org};
        }

        // load all relevant policies, apply relevant options
        return snyk.policy.load(policyLocations, {
          'ignore-policy': options['ignore-policy'],
          'trust-policies': options['trust-policies'],
          loose: true, // replace missing policies with empty ones
        })
        .then(function (policy) {
          payload.body.policy = policy.toString();
          return {
            package: pkg,
            payload: payload,
          };
        }, function (error) { // note: inline catch, to handle error from .load
          // the .snyk file wasn't found, which is fine, so we'll return
          if (error.code === 'ENOENT') {
            return {
              package: pkg,
              payload: payload,
            };
          }
          throw error;
        });
      });
    } else {
      var module = moduleToObject(root);
      debug('testing remote: %s', module.name + '@' + module.version);
      p = p.then(function () {
        payload.method = 'GET';
        payload.url += '/' +
          encodeURIComponent(module.name + '@' + module.version);
        if (options.org) {
          payload.qs = {org: options.org};
        }
        return {
          package: module,
          payload: payload,
        };
      });
    }

    var lbl = 'Querying vulnerabilities database...';
    return p.then(spinner(lbl)).then(function (data) {
      var filesystemPolicy = data.payload.body && !!data.payload.body.policy;
      analytics.add('packageManager', 'npm');
      analytics.add('packageName', data.package.name);
      analytics.add('packageVersion', data.package.version);
      analytics.add('package', data.package.name + '@' + data.package.version);

      return new Promise(function (resolve, reject) {
        request(data.payload, function (error, res, body) {
          if (error) {
            return reject(error);
          }

          if (res.statusCode !== 200) {
            var err = new Error(body && body.error ?
              body.error :
              res.statusCode);

            // this is the case where a local module has been tested, but
            // doesn't have any production deps, but we've noted that they
            // have dep deps, so we'll error with a more useful message
            if (res.statusCode === 404 && hasDevDependencies) {
              err.code = 'NOT_FOUND_HAS_DEV_DEPS';
            } else {
              err.code = res.statusCode;
            }

            if (res.statusCode === 500) {
              debug('Server error', body.stack);
            }

            return reject(err);
          }

          body.filesystemPolicy = filesystemPolicy;

          resolve(body);
        });
      });
    }).then(function (res) {
      if (modules) {
        res.dependencyCount = modules.numDependencies;
        if (res.vulnerabilities) {
          res.vulnerabilities.forEach(function (vuln) {
            var plucked = modules.pluck(vuln.from, vuln.name, vuln.version);
            vuln.__filename = plucked.__filename;
            vuln.shrinkwrap = plucked.shrinkwrap;
            vuln.bundled = plucked.bundled;

            // this is an edgecase when we're testing the directly vuln pkg
            if (vuln.from.length === 1) {
              return;
            }

            var parentPkg = moduleToObject(vuln.from[1]);
            var parent = modules.pluck(vuln.from.slice(0, 2),
                                       parentPkg.name,
                                       parentPkg.version);
            vuln.parentDepType = parent.depType;
          });
        }
      }
      return res;
    }).then(function (res) {
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      return Promise.resolve().then(function () {
        if (options['ignore-policy']) {
          return res;
        }

        return snyk.policy.loadFromText(res.policy)
        .then(function (policy) {
          return policy.filter(res, root);
        });
      }).then(function (res) {
        analytics.add('vulns', res.vulnerabilities.length);

        // add the unique count of vulnerabilities found
        res.uniqueCount = 0;
        var seen = {};
        res.uniqueCount = res.vulnerabilities.reduce(function (acc, curr) {
          if (!seen[curr.id]) {
            seen[curr.id] = true;
            acc++;
          }
          return acc;
        }, 0);

        return res;
      });
    }).then(spinner.clear(lbl));
  });

  return promise;
}


function pluckPolicies(pkg) {
  if (!pkg) {
    return null;
  }

  if (pkg.snyk) {
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return null;
  }

  return _.flatten(Object.keys(pkg.dependencies).map(function (name) {
    return pluckPolicies(pkg.dependencies[name]);
  }).filter(Boolean));
}
