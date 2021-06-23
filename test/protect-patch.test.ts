const protect = require('../src/lib/protect');
import * as path from 'path';
import { test } from 'tap';
import * as fs from 'fs';
import { exec } from 'child_process';

const vulns = JSON.parse(
  fs.readFileSync(__dirname + '/fixtures/semver-vuln.json', 'utf8'),
).vulnerabilities;

test('patch is correctly applied', async (t) => {
  const name = 'semver';
  const version = '2';
  const dir = path.resolve(__dirname, 'fixtures/protect');

  try {
    process.chdir(dir);

    await npm('install', name + '@' + version, dir);

    await protect.patch(vulns, true);
    t.pass('patch resolved');
  } catch (error) {
    t.fail('Should have passed' + error);
  }

  try {
    await npm('uninstall', name, dir);
    t.pass('packages cleaned up');
  } catch (error) {
    t.fail('Should have passed' + error);
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
