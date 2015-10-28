var debug = require('debug')('snyk');
var protect = require('../lib/protect');
var path = require('path');
var test = require('tape');
var vulns = require('./fixtures/semver-vuln.json').vulnerabilities;
var Promise = require('es6-promise').Promise; // jshint ignore:line
var exec = require('child_process').exec;

// skipped intentially - only used for debugging tests
test('patch is correctly skipped during tests', function (t) {
  var dir = path.resolve(__dirname, 'fixtures/protect-via-snyk');
  npm('install', '', dir).then(function () {
  // Promise.resolve().then(function () {
    debug('installing to %s', dir);


    return Promise.resolve({
      'patch': {
        'npm:semver:20150403': [
          {
            'semver@2.3.2': {
              'patched': '2015-10-27T16:30:18.628Z'
            }
          }
        ]
      },
      'ignore': {}
    })
    .then(function (rule) {
      return protect.filterPatched(rule.patch, vulns, dir);
    })
    .then(function (res) {
      // exact match
      var total = vulns.length;
      t.equal(res.length, total - 1, 'removed with * _only_ rule');
    });
  })
  .catch(function (error) {
    console.log(error.stack);
    t.fail(error);
  })
  .then(function () {
    return npm('uninstall', 'semver', dir).then(function () {
      t.pass('packages cleaned up');
      t.end();
    });
  })
  .catch(function (error) {
    console.log(error.stack);
    t.fail(error);
  });
});

function npm(method, packages, dir) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise(function (resolve, reject) {
    var cmd = 'npm ' + method + ' ' + packages.join(' ');
    debug(cmd);
    exec(cmd, {
      cwd: dir,
    }, function (error, stdout, stderr) {
      if (error) {
        return reject(error);
      }

      if (stderr) {
        // return reject(new Error(stderr.trim()));
      }

      resolve(stdout.trim());
    });
  });
}