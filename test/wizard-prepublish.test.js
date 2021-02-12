const test = require('tap').test;
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const spy = sinon.spy();
const fixture = require(__dirname + '/fixtures/protect-via-snyk/package.json');

var wizard = proxyquire('../src/cli/commands/protect/wizard', {
  '@snyk/inquirer': {
    prompt: function(q, cb) {
      cb(q);
    },
  },
  '../../../lib/npm': {
    getVersion: function() {
      return new Promise(function(resolve) {
        return resolve('4.9.9');
      });
    },
  },
  '../../../lib/protect': {
    install: () => new Promise((resolve) => resolve()),
    installDev: () => new Promise((resolve) => resolve()),
  },
  fs: {
    readFileSync: function() {
      return JSON.stringify(fixture);
    },
    writeFileSync: function(filename, body) {
      spy(body);
    },
  },
});

test('prepublish is added and postinstall is removed', function(t) {
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

      fixture.scripts.postinstall = 'true';
      fixture.scripts.prepublish = 'npm run snyk-protect';

      t.deepEqual(pkg, fixture, 'package is correct');
    });
});
