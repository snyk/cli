var test = require('tap').test;
var proxyquire = require('proxyquire');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var sinon = require('sinon');
var spy = sinon.spy();
var fixture = require(__dirname + '/fixtures/protect-via-snyk/package.json');

var snyk = require('../');

var wizard = proxyquire('../cli/commands/protect/wizard', {
  inquirer: {
    prompt: function (q, cb) {
      cb(q);
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

test('prepublish is added and postinstall is removed', function (t) {

  var save = snyk.policy.save;

  snyk.policy.save = function () {
    return Promise.resolve();
  };

  wizard.processAnswers({
    // answers
    'misc-test-no-monitor': true,
    'misc-add-protect': true,
  }, {
    // policy
  }).then(function () {
    t.equal(spy.callCount, 1, 'write functon was only called once');
    var pkg = JSON.parse(spy.args[0][0]);
    t.pass('package was valid JSON');

    fixture.scripts.postinstall = 'true';
    fixture.scripts.prepublish = 'npm run snyk-protect';

    t.deepEqual(fixture, pkg, 'package is correct');

  }).catch(t.threw).then(function () {
    snyk.policy.save = save;
    t.end();
  });
});