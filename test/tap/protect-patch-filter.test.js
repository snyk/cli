const debug = require('debug')('snyk');
const policy = require('snyk-policy');
const test = require('tap');
const { getFixturePath } = require('../jest/util/getFixturePath');
const vulns = require(getFixturePath('semver-vuln.json'));
const exec = require('child_process').exec;

// skipped intentially - only used for debugging tests
test.skip(
  'patch is correctly skipped during tests',
  { timeout: 1000 * 60 * 3 },
  function (t) {
    const dir = getFixturePath('protect-via-snyk');
    npm('install', '', dir)
      .then(function () {
        debug('installing to %s', dir);
        const rule = {
          patch: {
            'npm:semver:20150403': [
              {
                'semver@2.3.2': {
                  patched: '2015-10-27T16:30:18.628Z',
                },
              },
            ],
          },
          ignore: {},
        };

        const res = policy.filter(vulns, rule, dir);
        t.equal(res.ok, true, 'all vulns removed');
      })
      .catch(function (error) {
        console.log(error.stack);
        t.fail(error);
      })
      .then(function () {
        return npm('uninstall', ['semver', 'snyk'], dir).then(function () {
          t.pass('packages cleaned up');
          t.end();
        });
      })
      .catch(function (error) {
        console.log(error.stack);
        t.fail(error);
      });
  },
);

function npm(method, packages, dir) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise(function (resolve, reject) {
    const cmd = 'npm ' + method + ' ' + packages.join(' ');
    debug(cmd);
    exec(
      cmd,
      {
        cwd: dir,
      },
      function (error, stdout, stderr) {
        if (error) {
          return reject(error);
        }

        if (stderr) {
          // return reject(new Error(stderr.trim()));
        }

        resolve(stdout.trim());
      },
    );
  });
}
