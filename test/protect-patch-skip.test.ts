import * as path from 'path';
import { exec } from 'child_process';

import { test } from 'tap';
const protect = require('../src/lib/protect');
import { loadJson } from './utils';

const vulns = loadJson(__dirname + '/fixtures/lodash@4.17.11-vuln.json')
  .vulnerabilities;

test('patch is correctly applied', async (t) => {
  const name = 'lodash';
  const version = '4.17.13';

  const dir = path.resolve(__dirname, 'fixtures/protect');
  process.chdir(dir);
  try {
    await npm('install', name + '@' + version, dir);
    await protect.patch(vulns, true).then(() => {
      t.pass('patch resolved');
    });
  } catch (error) {
    t.fail('Should have passed: ' + error);
  }

  try {
    await npm('uninstall', name, dir).then(() => {
      t.pass('packages cleaned up');
      t.end();
    });
  } catch (error) {
    t.fail('Should have passed: ' + error);
  }
});

function npm(method, packages, dir) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise((resolve, reject) => {
    const cmd = 'npm ' + method + ' ' + packages.join(' ');
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
          return reject(new Error(stderr.trim()));
        }

        resolve(stdout.trim());
      },
    );
  });
}
