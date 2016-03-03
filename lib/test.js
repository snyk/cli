module.exports = test;

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('./request');
var path = require('path');
var fs = require('then-fs');
var protect = require('./protect');
var snyk = require('..');
var spinner = require('./spinner');
var moduleToOjbect = require('snyk-module');
var isCI = require('./is-ci');
var _ = require('lodash');
var analytics = require('./analytics');

// important: this is different from ./config (which is the *user's* config)
var config = require('./config');

function test(root, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (!options) {
    options = {};
  }

  var hasDevDependencies = false;
  var promise = fs.exists(root).then(function (exists) {
    // if the file exists, let's read the package file and post
    // that up to the server.
    // if it doesn't, then we're assuming this is an existing
    // module on npm, so send the bare argument
    var payload = {
      url: config.API + '/vuln/npm',
      json: true,
      headers: {
        'x-is-ci': isCI,
        authorization: 'token ' + snyk.api,
      },
    };

    var p = Promise.resolve();
    var policyLocations = [root];
    analytics.add('local', exists);
    var modules = null;
    if (exists) {
      p = snyk.modules(root, options).then(function (pkg) {
        modules = pkg;
        // if there's no package name, let's get it from the root dir
        if (!pkg.name) {
          pkg.name = path.basename(path.resolve(root));
        }
        analytics.add('package', pkg.name + '@' + pkg.version);
        policyLocations = policyLocations.concat(pluckPolicies(pkg));
        debug('policies found', policyLocations);
        analytics.add('policies', policyLocations.length);
        hasDevDependencies = pkg.hasDevDependencies;
        payload.method = 'POST';
        payload.body = pkg;
        return payload;
      });
    } else {
      var module = moduleToOjbect(root);
      analytics.add('package', root);
      debug('testing remote: %s', module.name + '@' + module.version);
      p = p.then(function () {
        payload.method = 'GET';
        payload.url += '/' +
          encodeURIComponent(module.name + '@' + module.version);
        return payload;
      });
    }

    var lbl = 'Querying vulnerabilities database...';
    return p.then(spinner(lbl)).then(function (payload) {
      return new Promise(function (resolve, reject) {
        request(payload, function (error, res, body) {
          if (error) {
            return reject(error);
          }

          if (res.statusCode !== 200) {
            var err = new Error(body ? body.error : res.statusCode);

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

          resolve(body);
        });
      });
    }).then(function (res) {
      if (modules && res.vulnerabilities) {
        res.vulnerabilities.forEach(function (vuln) {
          var plucked = modules.pluck(vuln.from, vuln.name, vuln.version);
          vuln.__filename = plucked.__filename;
          vuln.shrinkwrap = plucked.shrinkwrap;
          vuln.bundled = plucked.bundled;
        });
      }
      return res;
    }).then(function (res) {
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      options.loose = true; // allows merge without root policy
      return snyk.policy.load(policyLocations, options).then(function (config) {
        if (res.ok) {
          return res;
        }

        // strip the ignored modules from the results
        res.vulnerabilities = protect.filterIgnored(
          config.ignore,
          res.vulnerabilities,
          root
        );

        res.vulnerabilities = protect.filterPatched(
          config.patch,
          res.vulnerabilities,
          root
        );

        if (config.suggest) {
          res.vulnerabilities = protect.attachNotes(
            config.suggest,
            res.vulnerabilities,
            root
          );
        }

        // if there's no vulns after the ignore process, let's reset the `ok`
        // state and remove the vulns entirely.
        if (res.vulnerabilities.length === 0) {
          res.ok = true;
          delete res.vulnerabilities;
        }

        return res;
      }, function (error) { // note: inline catch, to handle error from .load
        // the .snyk file wasn't found, which is fine, so we'll return the vulns
        if (error.code === 'ENOENT') {
          return res;
        }
        throw error;
      }).then(function (res) {
        analytics.add('vulns', res.ok ? 0 : res.vulnerabilities.length);
        return res;
      });
    }).then(spinner.clear(lbl));
  });

  if (callback) {
    promise.then(function (res) {
      callback(null, res);
    }).catch(callback);
  }

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