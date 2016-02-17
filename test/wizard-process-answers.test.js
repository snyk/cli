var test = require('tap').test;
var proxyquire = require('proxyquire');
var tryRequire = require('snyk-try-require');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var sinon = require('sinon');
var spy = sinon.spy();
var execSpy = sinon.spy();
var noop = function () {};
var snyk = require('../');

var wizard = proxyquire('../cli/commands/protect/wizard', {
  '../../../lib/exec': function (cmd, root) {
    execSpy(cmd, root);
    return Promise.resolve();
  },
  '../../../lib/protect': proxyquire('../lib/protect', {
    'then-fs': {
      writeFile: function () {
        return Promise.resolve();
      },
      createWriteStream: function () {
        // fake event emitter (sort of)
        return {
          on: noop,
          end: noop,
          removeListener: noop,
          emit: noop,
        };
      },
    },
    'fs': {
      statSync: function () {
        return true;
      }
    },
    'child_process': {
      exec: function (a, b, callback) {
        callback(null, '', ''); // successful patch
      }
    }
  })
});


test('pre-tarred packages can be patched', function (t) {
  var answers = require(__dirname + '/fixtures/forever-answers.json');
  var save = snyk.policy.save;

  snyk.policy.save = function (data) {
    spy(data);
    return Promise.resolve();
  };

  wizard.processAnswers(answers, {
    // policy
  }).then(function () {
    t.equal(spy.callCount, 1, 'write functon was only called once');
    var vulns = Object.keys(spy.args[0][0].patch);
    var expect = Object.keys(answers).filter(function (key) {
      return key.slice(0, 5) !== 'misc-';
    }).map(function (key) {
      return answers[key].vuln.id;
    });
    t.deepEqual(vulns, expect, 'two patches included');
  }).catch(t.threw).then(function () {
    snyk.policy.save = save;
    t.end();
  });
});

test('process answers handles shrinkwrap', function (t) {
  var save = snyk.policy.save;
  snyk.policy.save = function () {
    return Promise.resolve();
  };

  t.plan(3);

  t.test('non-shrinkwrap package', function (t) {
    execSpy = sinon.spy();
    var answers = require(__dirname + '/fixtures/forever-answers.json');
    wizard.processAnswers(answers).then(function () {
      t.equal(execSpy.callCount, 0, 'shrinkwrap was not called');
    }).catch(t.threw).then(t.end);
  });

  t.test('shrinkwraped package', function (t) {
    execSpy = sinon.spy();
    var cwd = process.cwd();
    process.chdir(__dirname + '/fixtures/pkg-mean-io/');
    var answers = require(__dirname + '/fixtures/mean-answers.json');
    wizard.processAnswers(answers).then(function () {
      t.equal(execSpy.callCount, 1, 'shrinkwrap was called');
      process.chdir(cwd);
    }).catch(t.threw).then(t.end);

  });

  t.test('teardown', function (t) {
    snyk.policy.save = save;
    t.pass('teardown complete');
    t.end();
  });
});