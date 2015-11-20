var debug = require('debug')('snyk');
var wizard = require('../cli/commands/protect/wizard');
var dotfile = require('../lib/dotfile');
var path = require('path');
var test = require('tape');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var exec = require('child_process').exec;
var vulns = require('./fixtures/debug-2.1.0-vuln.json').vulnerabilities;

test('patch via wizard produces policy (on debug@2.1.0)', function (t) {
  var name = 'debug';
  var version = '2.1.0';
  var cwd = process.cwd();
  var id = 'npm:ms:20151024';

  t.plan(3);

  var dir = path.resolve(__dirname, 'fixtures/debug-package');
  npm('install', name + '@' + version, dir).then(function () {
    debug('installed to %s, cd-ing to %s', dir, dir + '/node_modules/debug');
    process.chdir(dir + '/node_modules/debug');
  })
  .then(function () {
    var answers = {
      // answers
      'misc-test-no-monitor': true,
    };

    answers[id + '-0'] = {
      choice: 'patch',
      vuln: vulns[0], // only contains 1 vuln (ms@0.6.2)
    };

    return wizard.processAnswers(answers, {
      // policy
    }).then(function () {
      // now check if the policy file worked.
      return dotfile.load(process.cwd()).then(function (res) {
        var patched = Object.keys(res.patch);
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

});

function npm(method, packages, dir) {
  if (!Array.isArray(packages)) {
    packages = [packages];
  }
  return new Promise(function (resolve, reject) {
    // `--prefix .` forces the install to take place, even if we have it
    // installed ourselves
    var cmd = 'npm ' + method + ' --prefix . ' + packages.join(' ');
    debug('%s in %s', cmd, dir);
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