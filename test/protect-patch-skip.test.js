'use strict';
const debug = require('debug')('snyk');
const protect = require('../src/lib/protect');
const path = require('path');
const test = require('tape');
const vulns = require('./fixtures/lodash@4.17.11-vuln.json').vulnerabilities;
const exec = require('child_process').exec;

test('patch is correctly applied', (t) => {
  const name = 'lodash';
  const version = '4.17.13';

  const dir = path.resolve(__dirname, 'fixtures/protect');
  npm('install', name + '@' + version, dir)
    .then(() => {
      debug('installing to %s', dir);
      return protect.patch(vulns, true, dir).then(() => {
        t.pass('patch resolved');
      });
    })
    .catch((error) => {
      console.log(error.stack);
      t.fail(error);
    })
    .then(() => {
      return npm('uninstall', name, dir).then(() => {
        t.pass('packages cleaned up');
        t.end();
      });
    })
    .catch((error) => {
      console.log(error.stack);
      t.fail(error);
    });
});

function npm(method, packages, dir) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise(function(resolve, reject) {
    const cmd = 'npm ' + method + ' ' + packages.join(' ');
    debug(cmd);
    exec(
      cmd,
      {
        cwd: dir,
      },
      function(error, stdout, stderr) {
        if (error) {
          return reject(error);
        }

        if (stderr) {
          return reject(new Error(stderr.trim()));
        }

        resolve(stdout.trim());
      },
    );
  });
}
