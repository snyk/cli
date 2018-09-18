var tap = require('tap');
var test = tap.test;
var debug = require('debug')('snyk');
var wizard = require('../src/cli/commands/protect/wizard');
var policy = require('snyk-policy');
var mockPolicy;
var path = require('path');
var fs = require('fs');
var exec = require('child_process').exec;
var vulns = require('./fixtures/debug-2.1.0-vuln.json').vulnerabilities;
var iswindows = require('os-name')().toLowerCase().indexOf('windows') === 0;

tap.beforeEach(done => {
  policy.create().then(p => {
    mockPolicy = p;
    done();
  });
});

test('patch via wizard produces policy (on debug@2.1.0)', { skip: iswindows }, function (t) {
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

    return wizard.processAnswers(answers, mockPolicy).then(function () {
      // now check if the policy file worked.
      return policy.load(process.cwd()).then(function (res) {
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

test('patch via wizard produces policy (on openapi-node@3.0.3)', { skip: iswindows }, function (t) {
  var name = 'openapi-node';
  var version = '3.0.3';
  var cwd = process.cwd();
  var id = 'npm:qs:20140806-1';
  var altId = 'npm:qs:20140806';
  var answers = require('./fixtures/openapi-node/answers.json');

  t.plan(3);

  var dir = path.resolve(__dirname, 'fixtures/' + name);
  npm('install', name + '@' + version, dir).then(function () {
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
        var patched = Object.keys(res.patch).sort();
        var target = [id, altId].sort();
        t.equal(patched.length, 2, 'contains 2 patches, even though 1 was applied');
        t.deepEqual(patched, target, 'added all the patched vulns to the policy');
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

      if (stderr.indexOf('ERR!') !== -1) {
        return reject(new Error(stderr.trim()));
      }

      resolve(stdout.trim());
    });
  });
}
