module.exports = monitor;

var snyk = require('..');
var apiTokenExists = require('./api-token').exists;
var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('./request');
var config = require('./config');
var os = require('os');
var _ = require('../dist/lodash-min');
var isCI = require('./is-ci');
var analytics = require('./analytics');

function monitor(root, meta, modules) {
  var policyLocations = [root];
  policyLocations = policyLocations.concat(pluckPolicies(modules));
  var opts = { loose: true };
  var packageManager = meta.packageManager || 'npm';
  return apiTokenExists('snyk monitor')
    .then(function () {
      return snyk.policy.load(policyLocations, opts);
    }).then(function (policy) {
      analytics.add('packageManager', packageManager);
      return new Promise(function (resolve, reject) {
        request({
          body: {
            meta: {
              method: meta.method,
              hostname: os.hostname(),
              id: meta.id || snyk.id || modules.name,
              ci: isCI,
              pid: process.pid,
              node: process.version,
              master: snyk.config.isMaster,
              name: modules.name,
              version: modules.version,
              org: config.org ? decodeURIComponent(config.org) : undefined,
            },
            policy: policy.toString(),
            package: modules,
          },
          gzip: true,
          method: 'PUT',
          headers: {
            authorization: 'token ' + snyk.api,
            'content-encoding': 'gzip',
          },
          url: config.API + '/monitor/' + packageManager,
          json: true,
        }, function (error, res, body) {
          if (error) {
            return reject(error);
          }

          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve(body);
          } else {
            var e = new Error('unexpected error: ' + body.message);
            e.code = res.statusCode;
            reject(e);
          }
        });
      });
    });
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
