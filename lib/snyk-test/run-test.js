module.exports = runTest;

var debug = require('debug')('snyk');
var fs = require('then-fs');
var moduleToObject = require('snyk-module');
var Promise = require('es6-promise').Promise; // jshint ignore:line

var analytics = require('../analytics');
var config = require('../config');
var detect = require('../../lib/detect');
var plugins = require('../plugins');
var ModuleInfo = require('../module-info');
var isCI = require('../is-ci');
var request = require('../request');
var snyk = require('../');
var spinner = require('../spinner');


function runTest(packageManager, root, options) {
  return Promise.resolve().then(function () {
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
}

function assemblePayload(root, options, policyLocations) {
  var local = fs.existsSync(root);
  analytics.add('local', local);
  analytics.add('packageManager', options.packageManager);
  return local ? assembleLocalPayload(root, options, policyLocations)
    : assembleRemotePayload(root, options);
}

function assembleLocalPayload(root, options, policyLocations) {
  var targetFile = options.file || detect.detectPackageFile(root);
  var plugin = plugins.loadPlugin(options.packageManager);
  var moduleInfo = ModuleInfo(plugin, options.policy);
  return moduleInfo.inspect(root, targetFile, options._doubleDashArgs)
  .then(function (info) {
    var pkg = info.package;
    analytics.add('policies', policyLocations.length);
    analytics.add('packageName', pkg.name);
    analytics.add('packageVersion', pkg.version);
    analytics.add('package', pkg.name + '@' + pkg.version);
    var payload = {
      method: 'POST',
      url: vulnUrl(options.packageManager),
      json: true,
      headers: {
        'x-is-ci': isCI,
        authorization: 'token ' + snyk.api,
      },
      body: pkg,
    };
    if (options.org) {
      payload.qs = {org: options.org};
    }
    return payload;
  });
}

function assembleRemotePayload(root, options) {
  var pkg = moduleToObject(root);
  var encodedName = encodeURIComponent(pkg.name + '@' + pkg.version);
  debug('testing remote: %s', pkg.name + '@' + pkg.version);
  analytics.add('packageName', pkg.name);
  analytics.add('packageVersion', pkg.version);
  analytics.add('package', pkg.name + '@' + pkg.version);
  var payload = {
    method: 'GET',
    url: vulnUrl(options.packageManager) + '/' + encodedName,
    json: true,
    headers: {
      'x-is-ci': isCI,
      authorization: 'token ' + snyk.api,
    },
  };
  if (options.org) {
    payload.qs = {org: options.org};
  }
  return Promise.resolve(payload);
}

function vulnUrl(packageManager) {
  return config.API + '/vuln/' + packageManager;
}
