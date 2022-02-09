const tap = require('tap');
const test = tap.test;
const debug = require('debug')('snyk');
const wizard = require('../../src/cli/commands/protect/wizard');
const policy = require('snyk-policy');
let mockPolicy;
const fs = require('fs');
const exec = require('child_process').exec;
const { getFixturePath } = require('../jest/util/getFixturePath');
const vulns = require(getFixturePath('debug-2.1.0-vuln.json')).vulnerabilities;
const iswindows = require('os-name')().toLowerCase().indexOf('windows') === 0;

tap.beforeEach((done) => {
  policy.create().then((p) => {
    mockPolicy = p;
    done();
  });
});

test(
  'patch via wizard produces policy (on debug@2.1.0)',
  { skip: iswindows },
  function (t) {
    const name = 'debug';
    const version = '2.1.0';
    const cwd = process.cwd();
    const id = 'npm:ms:20151024';

    t.plan(3);

    const dir = getFixturePath('debug-package');
    npm('install', name + '@' + version, dir)
      .then(function () {
        debug(
          'installed to %s, cd-ing to %s',
          dir,
          dir + '/node_modules/debug',
        );
        process.chdir(dir + '/node_modules/debug');
      })
      .then(function () {
        const answers = {
          // answers
          'misc-test-no-monitor': true,
        };

        answers[id + '-0'] = {
          choice: 'patch',
          vuln: vulns[0], // only contains 1 vuln (ms@0.6.2)
        };

        return wizard.processAnswers(answers, mockPolicy).then(function () {
          // now check if the policy file worked.
          return policy.load(process.cwd()).then(function (res) {
            const patched = Object.keys(res.patch);
            t.equal(patched.length, 1, 'contains 1 patch');
            t.equal(patched[0], id, 'patch contains the correct vuln id');
          });
        });
      })
      .catch(function (error) {
        console.log(error.stack);
        t.fail(error);
      })
      .then(function () {
        return npm('uninstall', name, dir).then(function () {
          process.chdir(cwd); // restore cwd
          t.pass('packages cleaned up');
        });
      });
  },
);

test(
  'patch via wizard produces policy (on openapi-node@3.0.3)',
  { skip: iswindows },
  function (t) {
    const name = 'openapi-node';
    const version = '3.0.3';
    const cwd = process.cwd();
    const id = 'npm:qs:20140806-1';
    const altId = 'npm:qs:20140806';
    const answers = require(getFixturePath('openapi-node/answers.json'));

    t.plan(3);

    const dir = getFixturePath(name);
    npm('install', name + '@' + version, dir)
      .then(function () {
        // debug('installed to %s, cd-ing to %s', dir, dir + '/node_modules/' + name);
        process.chdir(dir);
      })
      .then(function () {
        // prevents monitor run, and package updates
        answers['misc-test-no-monitor'] = true;
        answers['misc-add-test'] = false;
        answers['misc-add-protect'] = false;

        return wizard.processAnswers(answers, mockPolicy).then(function () {
          // now check if the policy file worked.
          return policy.load(process.cwd()).then(function (res) {
            const patched = Object.keys(res.patch).sort();
            const target = [id, altId].sort();
            t.equal(
              patched.length,
              2,
              'contains 2 patches, even though 1 was applied',
            );
            t.deepEqual(
              patched,
              target,
              'added all the patched vulns to the policy',
            );
          });
        });
      })
      .catch(function (error) {
        console.log(error.stack);
        t.fail(error);
      })
      .then(function () {
        return npm('uninstall', name, dir).then(function () {
          fs.unlinkSync('.snyk');
          process.chdir(cwd); // restore cwd
          t.pass('packages cleaned up');
        });
      });
  },
);

function npm(method, packages, dir) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise(function (resolve, reject) {
    // `--prefix .` forces the install to take place, even if we have it
    // installed ourselves
    const cmd = 'npm ' + method + ' --prefix . ' + packages.join(' ');
    debug('%s in %s', cmd, dir);
    exec(
      cmd,
      {
        cwd: dir,
      },
      function (error, stdout, stderr) {
        if (error) {
          return reject(error);
        }

        if (stderr.indexOf('ERR!') !== -1) {
          return reject(new Error(stderr.trim()));
        }

        resolve(stdout.trim());
      },
    );
  });
}
