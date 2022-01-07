import * as debugModule from 'debug';
const debug = debugModule('snyk');
const protect = require('../../src/lib/protect');
import * as path from 'path';
import { test } from 'tap';
import { getFixturePath } from '../jest/util/getFixturePath';
const vulns = require(getFixturePath('hoek@4.2.0-vuln.json')).vulnerabilities;
const unpatchableVulns = require(getFixturePath('hoek@4.2.0-nopatch.json'))
  .vulnerabilities;
import { exec } from 'child_process';
import { readFileSync } from 'fs';

test('patch is correctly applied', (t: any) => {
  const name = 'hoek';
  const version = '4.2.0';

  const dir = getFixturePath('protect-semver-patch');

  // snyk protect uses cwd() all over the place,
  // the problem is that cwd() is not fixtures/protect-semver-patch so
  // we end up resolving to the snyk CLI repo path (and its node_modules).
  // Replace with the right path while the test is running.
  const cwdBackup = process.cwd;

  npm('install', name + '@' + version, dir)
    .then(() => {
      debug('installing to %s', dir);

      process.cwd = () => dir;

      return protect
        .patch(vulns, true)
        .then(() => {
          t.pass('patch resolved');
        })
        .then(() => {
          const content = readFileSync(
            path.resolve(dir, 'node_modules', 'hoek', 'lib', 'index.js'),
            'utf-8',
          );
          if (content.includes("if (key === '__proto__') {")) {
            t.ok('applied the patch');
          } else {
            t.fail('did not apply the patch');
          }
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
    })
    .then(() => {
      process.cwd = cwdBackup;
    });
});

test('no patch is applied when patch is unavailable', (t: any) => {
  const name = 'hoek';
  const version = '4.2.0';

  const dir = getFixturePath('protect-semver-patch');

  // snyk protect uses cwd() all over the place,
  // the problem is that cwd() is not fixtures/protect-semver-patch so
  // we end up resolving to the snyk CLI repo path (and its node_modules).
  // Replace with the right path while the test is running.
  const cwdBackup = process.cwd;

  npm('install', name + '@' + version, dir)
    .then(() => {
      debug('installing to %s', dir);

      process.cwd = () => dir;

      return protect
        .patch(unpatchableVulns, true)
        .then((result) => {
          t.deepEqual(result, { patch: {} }, 'no patch could be applied');
        })
        .then(() => {
          const content = readFileSync(
            path.resolve(dir, 'node_modules', 'hoek', 'lib', 'index.js'),
            'utf-8',
          );
          if (content.includes("if (key === '__proto__') {")) {
            t.fail('patch should not have been applied');
          } else {
            t.ok('patch was not applied as expected');
          }
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
    })
    .then(() => {
      process.cwd = cwdBackup;
    });
});

function npm(method, packages, dir) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise((resolve, reject) => {
    const cmd = 'npm ' + method + ' ' + packages.join(' ');
    debug(cmd);
    exec(
      cmd,
      {
        cwd: dir,
      },
      (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        if (stderr) {
          console.log(stderr.trim());
        }

        resolve(stdout.trim());
      },
    );
  });
}
