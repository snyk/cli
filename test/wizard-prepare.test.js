var test = require('tap').test;
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var spy = sinon.spy();
var _ = require('lodash');
var fixture = require('./fixtures/protect-via-snyk/package.json');

var wizard = proxyquire('../src/cli/commands/protect/wizard', {
  inquirer: {
    prompt: function (q, cb) {
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
  'then-fs': {
    readFile: function () {
      return Promise.resolve(JSON.stringify(fixture));
    },
    writeFile: function (filename, body) {
      spy(body);
      return Promise.resolve();
    },
  }
});

test('npm - prepare is added and postinstall is removed', function (t) {
  var expectedResults = _.cloneDeep(fixture);
  return wizard.processAnswers({
    // answers
    'misc-test-no-monitor': true,
    'misc-add-protect': true,
  }, {
    save: () => Promise.resolve()
  }).then(function () {
    t.equal(spy.callCount, 1, 'write function was only called once');
    var pkg = JSON.parse(spy.args[0][0]);
    t.pass('package was valid JSON');

    expectedResults.scripts.postinstall = 'true';
    expectedResults.scripts.prepare = 'npm run snyk-protect';

    t.deepEqual(expectedResults, pkg, 'package is correct');
  });
});

test('yarn - prepare is added and postinstall is removed', function (t) {
  var expectedResults = _.cloneDeep(fixture);
  spy.reset();
  return wizard.processAnswers({
    // answers
    'misc-test-no-monitor': true,
    'misc-add-protect': true,
  }, {
    save: () => Promise.resolve()
  }, {
    packageManager: 'yarn',
  }).then(function () {
    t.equal(spy.callCount, 1, 'write function was only called once');
    var pkg = JSON.parse(spy.args[0][0]);
    t.pass('package was valid JSON');

    expectedResults.scripts.postinstall = 'true';
    expectedResults.scripts.prepare = 'yarn run snyk-protect';

    t.deepEqual(expectedResults, pkg, 'package is correct');
  });
});
