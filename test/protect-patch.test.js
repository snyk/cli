'use strict';
var debug = require('debug')('snyk');
var protect = require('../src/lib/protect');
var path = require('path');
var test = require('tape');
var vulns = require('./fixtures/semver-vuln.json').vulnerabilities;
var exec = require('child_process').exec;

test('patch is correctly applied', function (t) {
  var name = 'semver';
  var version = '2';

  var dir = path.resolve(__dirname, 'fixtures/protect');
  npm('install', name + '@' + version, dir).then(function () {
    debug('installing to %s', dir);
    return protect.patch(vulns, true, dir).then(function () {
      t.pass('patch resolved');
    });
  })
  .catch(function (error) {
    console.log(error.stack);
    t.fail(error);
  })
  .then(function () {
    return npm('uninstall', name, dir).then(function () {
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
        return reject(new Error(stderr.trim()));
      }

      resolve(stdout.trim());
    });
  });
}
