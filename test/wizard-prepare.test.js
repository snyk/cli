var test = require('tap').test;
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var spy = sinon.spy();
var _ = require('@snyk/lodash');
var dir = __dirname + '/fixtures/protect-via-snyk/';
var fixture = require('./fixtures/protect-via-snyk/package.json');

var wizard = proxyquire('../src/cli/commands/protect/wizard', {
  '@snyk/inquirer': {
    prompt: function(q, cb) {
      cb(q);
    },
  },
  '../../../lib/npm': {
    getVersion: function() {
      return new Promise(function(resolve) {
        return resolve('5.0.1');
      });
    },
  },
  '../../../lib/protect': {
    install: () => new Promise((resolve) => resolve()),
    installDev: () => new Promise((resolve) => resolve()),
  },
  'then-fs': {
    readFile: function() {
      return Promise.resolve(JSON.stringify(fixture));
    },
    writeFile: function(filename, body) {
      spy(body);
      return Promise.resolve();
    },
  },
});

test('npm - prepare is added and postinstall is removed', function(t) {
  var expectedResults = _.cloneDeep(fixture);
  process.chdir(dir);

  return wizard
    .processAnswers(
      {
        // answers
        'misc-test-no-monitor': true,
        'misc-add-protect': true,
      },
      {
        save: () => Promise.resolve(),
      },
    )
    .then(function() {
      t.equal(spy.callCount, 1, 'write function was only called once');
      var pkg = JSON.parse(spy.args[0][0]);
      t.pass('package was valid JSON');

      expectedResults.scripts.postinstall = 'true';
      expectedResults.scripts.prepare = 'npm run snyk-protect';

      t.deepEqual(pkg, expectedResults, 'package is correct');
    });
});

test('yarn - prepare is added and postinstall is removed', function(t) {
  var expectedResults = _.cloneDeep(fixture);
  process.chdir(dir);
  spy.resetHistory();
  return wizard
    .processAnswers(
      {
        // answers
        'misc-test-no-monitor': true,
        'misc-add-protect': true,
      },
      {
        save: () => Promise.resolve(),
      },
      {
        packageManager: 'yarn',
      },
    )
    .then(function() {
      t.equal(spy.callCount, 1, 'write function was only called once');
      var pkg = JSON.parse(spy.args[0][0]);
      t.pass('package was valid JSON');

      expectedResults.scripts.postinstall = 'true';
      expectedResults.scripts.prepare = 'yarn run snyk-protect';

      t.deepEqual(pkg, expectedResults, 'package is correct');
    });
});
