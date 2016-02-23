var test = require('tap-only');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var snyk = require('../lib');

test('analytics disabled', function (t) {
  var spy = sinon.spy();
  var old = snyk.config.get('disable-analytics');
  snyk.config.set('disable-analytics', '1');
  var analytics = proxyquire('../lib/analytics', {
    './request': spy,
  });

  t.plan(1);
  analytics().then(function () {
    t.equal(spy.called, false, 'the request should not have been made');
    if (old === undefined) {
      snyk.config.del('disable-analytics');
    } else {
      snyk.config.set('disable-analytics', old);
    }
  });
});

test('analytics', function (t) {
  var spy = sinon.spy();
  var old = snyk.config.get('disable-analytics');
  snyk.config.del('disable-analytics');
  var analytics = proxyquire('../lib/analytics', {
    './request': spy,
  });

  t.plan(1);

  analytics.add('foo', 'bar');

  analytics({
    command: '__test__',
    args: [],
  }).then(function () {
    var body = spy.lastCall.args[0].body.data;
    t.deepEqual(Object.keys(body).sort(), ['command', 'os', 'version', 'id', 'ci', 'metadata', 'args'].sort(), 'keys as expected');
    if (old === undefined) {
      snyk.config.del('disable-analytics');
    } else {
      snyk.config.set('disable-analytics', old);
    }
  });

});

test('bad command', function (t) {
  var spy = sinon.spy();
  var old = snyk.config.get('disable-analytics');
  snyk.config.del('disable-analytics');
  process.argv = ['node', 'script.js', 'random command', '-q'];
  var cli = proxyquire('../cli', {
    '../lib/analytics': proxyquire('../lib/analytics', {
      './request': spy,
    })
  });

  return cli.then(function () {
    t.equal(spy.callCount, 1, 'analytics was called');

    var payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'cli-bad-command', 'correct event name');
    t.equal(payload.data.metadata.command, 'random command', 'found original command');

    if (old === undefined) {
      snyk.config.del('disable-analytics');
    } else {
      snyk.config.set('disable-analytics', old);
    }
  });
});