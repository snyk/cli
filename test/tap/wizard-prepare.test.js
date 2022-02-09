const test = require('tap').test;
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const spy = sinon.spy();
const cloneDeep = require('lodash.clonedeep');
const { getFixturePath } = require('../jest/util/getFixturePath');
const dir = getFixturePath('protect-via-snyk');
const fixture = require(getFixturePath('protect-via-snyk/package.json'));

const wizard = proxyquire('../../src/cli/commands/protect/wizard', {
  '@snyk/inquirer': {
    prompt: function (q, cb) {
      cb(q);
    },
  },
  '../../../lib/npm': {
    getVersion: function () {
      return new Promise(function (resolve) {
        return resolve('5.0.1');
      });
    },
  },
  '../../../lib/protect': {
    install: () => new Promise((resolve) => resolve()),
    installDev: () => new Promise((resolve) => resolve()),
  },
  fs: {
    readFileSync: function () {
      return JSON.stringify(fixture);
    },
    writeFileSync: function (filename, body) {
      spy(body);
    },
  },
});

test('npm - prepare is added and postinstall is removed', function (t) {
  const expectedResults = cloneDeep(fixture);
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
    .then(function () {
      t.equal(spy.callCount, 1, 'write function was only called once');
      const pkg = JSON.parse(spy.args[0][0]);
      t.pass('package was valid JSON');

      expectedResults.scripts.postinstall = 'true';
      expectedResults.scripts.prepare = 'npm run snyk-protect';

      t.deepEqual(pkg, expectedResults, 'package is correct');
    });
});

test('yarn - prepare is added and postinstall is removed', function (t) {
  const expectedResults = cloneDeep(fixture);
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
    .then(function () {
      t.equal(spy.callCount, 1, 'write function was only called once');
      const pkg = JSON.parse(spy.args[0][0]);
      t.pass('package was valid JSON');

      expectedResults.scripts.postinstall = 'true';
      expectedResults.scripts.prepare = 'yarn run snyk-protect';

      t.deepEqual(pkg, expectedResults, 'package is correct');
    });
});
