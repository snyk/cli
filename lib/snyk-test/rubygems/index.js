module.exports = test;

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('../../request');
var fs = require('then-fs');
var snyk = require('../..');
var spinner = require('../../spinner');
var moduleToOjbect = require('snyk-module');
var isCI = require('../../is-ci');
var analytics = require('../../analytics');
var config = require('../../config');
var getModuleInfo = require('../../module-info');

function test(root, options) {
  var promise = Promise.resolve().then(function () {
    var policyLocations = [root];
    var hasDevDependencies = false;
    var lbl = 'Querying vulnerabilities database...';
    return assemblePayload(root, options, policyLocations)
    .then(spinner(lbl))
    .then(function (payload) {
      return new Promise(function (resolve, reject) {
        request(payload, function (error, res, body) {
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

          resolve(body);
        });
      });
    }).then(function (res) {
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      options.loose = true; // allows merge without root policy
      return snyk.policy.load(policyLocations, options)
      .then(function (policy) {
        return policy.filter(res, root);
      }, function (error) { // note: inline catch, to handle error from .load
        // the .snyk file wasn't found, which is fine, so we'll return the vulns
        if (error.code === 'ENOENT') {
          return res;
        }
        throw error;
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

function assemblePayload(root, options, policyLocations) {
  var local = fs.existsSync(root);
  analytics.add('local', local);
  analytics.add('packageManager', 'rubygems');
  return local ? assembleLocalPayload(root, options, policyLocations)
    : assembleRemotePayload(root);
}

function assembleLocalPayload(root, options, policyLocations) {
  return getModuleInfo('rubygems', root, options)
  .then(function (module) {
    analytics.add('policies', policyLocations.length);
    analytics.add('packageName', module.name);
    analytics.add('packageVersion', module.version);
    analytics.add('package', module.name + '@' + module.version);
    var payload = {
      method: 'POST',
      url: vulnUrl(),
      json: true,
      headers: {
        'x-is-ci': isCI,
        authorization: 'token ' + snyk.api,
      },
      body: module,
    };
    return payload;
  });
}

function assembleRemotePayload(root) {
  var module = moduleToOjbect(root);
  debug('testing remote: %s', module.name + '@' + module.version);
  var encodedName = encodeURIComponent(module.name + '@' + module.version);
  analytics.add('packageName', module.name);
  analytics.add('packageVersion', module.version);
  analytics.add('package', module.name + '@' + module.version);
  var payload = {
    method: 'GET',
    url: vulnUrl() + '/' + encodedName,
    json: true,
    headers: {
      'x-is-ci': isCI,
      authorization: 'token ' + snyk.api,
    },
  };
  return Promise.resolve(payload);
}

function vulnUrl() {
  return config.API + '/vuln/rubygems';
}
