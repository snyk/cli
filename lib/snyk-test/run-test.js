module.exports = runTest;

var debug = require('debug')('snyk');
var fs = require('then-fs');
var moduleToObject = require('snyk-module');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var pathUtil = require('path');

var analytics = require('../analytics');
var config = require('../config');
var detect = require('../../lib/detect');
var plugins = require('../plugins');
var ModuleInfo = require('../module-info');
var isCI = require('../is-ci');
var request = require('../request');
var snyk = require('../');
var spinner = require('../spinner');
var common = require('./common');


function runTest(packageManager, root, options) {
  return Promise.resolve().then(function () {
    var policyLocations = [options['policy-path'] || root];
    var hasDevDependencies = false;
    var lbl = 'Querying vulnerabilities database...';
    return assemblePayload(root, options, policyLocations)
    .then(function (res) {
      return spinner(lbl).then(function () {return res});
    })
    .then(function (payload) {
      var filesystemPolicy = payload.body && !!payload.body.policy;
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

          body.filesystemPolicy = filesystemPolicy;

          resolve(body);
        });
      });
    }).then(function (res) {
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      return Promise.resolve()
      .then(function () {
        if (options['ignore-policy']) {
          return res;
        }

        return snyk.policy.loadFromText(res.policy)
        .then(function (policy) {
          return policy.filter(res, root);
        });
      })
      .then(function (res) {
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
  options.file = options.file || detect.detectPackageFile(root);
  var plugin = plugins.loadPlugin(options.packageManager);
  var moduleInfo = ModuleInfo(plugin, options.policy);
  var lbl =
    'Analyzing ' + options.packageManager + ' dependencies for ' +
    pathUtil.relative('.', pathUtil.join(root, options.file));
  return spinner(lbl)
  .then(function () {
    return moduleInfo.inspect(root, options.file, options)
  })
  .then(spinner.clear(lbl))
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
    payload.qs = common.assembleQueryString(options);
    return snyk.policy.load(policyLocations, options)
    .then(function (policy) {
      payload.body.policy = policy.toString();
      return payload;
    }, function (error) { // note: inline catch, to handle error from .load
      // the .snyk file wasn't found, which is fine, so we'll return the payload
      if (error.code === 'ENOENT') {
        return payload;
      }
      throw error;
    });
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
  payload.qs = common.assembleQueryString(options);
  return Promise.resolve(payload);
}

function vulnUrl(packageManager) {
  return config.API + '/vuln/' + packageManager;
}
