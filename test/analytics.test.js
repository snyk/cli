var tap = require('tap');
var test = require('tap').test;
var proxyquire = require('proxyquire').noPreserveCache();
var sinon = require('sinon');
var snyk = require('../src/lib');
var old;
var iswindows = require('os-name')().toLowerCase().indexOf('windows') === 0;

tap.beforeEach(function (done) {
  old = snyk.config.get('disable-analytics');
  snyk.config.delete('disable-analytics');
  done();
});

tap.afterEach(function (done) {
  if (old === undefined) {
    snyk.config.delete('disable-analytics');
  } else {
    snyk.config.set('disable-analytics', old);
  }
  done();
});

test('analytics disabled', function (t) {
  var spy = sinon.spy();
  snyk.config.set('disable-analytics', '1');
  var analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  return analytics().then(function () {
    t.equal(spy.called, false, 'the request should not have been made');
  });
});

test('analytics', function (t) {
  var spy = sinon.spy();
  var analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  analytics.add('foo', 'bar');

  return analytics({
    command: '__test__',
    args: [],
  }).then(function () {
    var body = spy.lastCall.args[0].body.data;
    t.deepEqual(Object.keys(body).sort(), ['command', 'os', 'version', 'id', 'ci', 'metadata', 'args', 'nodeVersion', 'durationMs'].sort(), 'keys as expected');
  });
});

test('bad command', function (t) {
  var spy = sinon.spy();
  process.argv = ['node', 'script.js', 'random command', '-q'];
  var cli = proxyquire('../src/cli', {
    '../lib/analytics': proxyquire('../src/lib/analytics', {
      './request': spy,
    })
  });

  return cli.then(function () {
    t.equal(spy.callCount, 1, 'analytics was called');

    var payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'bad-command', 'correct event name');
    t.equal(payload.data.metadata.command, 'random command', 'found original command');
    t.equal(payload.data.metadata['error-message'],
      'Unknown command "random command"', 'got correct error');
  });
});

test('bad command with string error', function (t) {
  var spy = sinon.spy();
  process.argv = ['node', 'script.js', 'test', '-q'];
  var cli = proxyquire('../src/cli', {
    '../lib/analytics': proxyquire('../src/lib/analytics', {
      './request': spy,
    }),

    './args': proxyquire('../src/cli/args', {
      './commands': proxyquire('../src/cli/commands', {
        '../../lib/hotload': proxyquire('../src/lib/hotload', {
          // windows-based testing uses windows path separator
          '..\\cli\\commands\\test': function() {
            return Promise.reject('string error');
          },
          '../cli/commands/test': function()  {
            return Promise.reject('string error');
          }
        })
      })
    })
  });

  return cli.then(function () {
    t.equal(spy.callCount, 1, 'analytics was called');

    var payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'bad-command', 'correct event name');
    t.equal(payload.data.metadata.command, 'test', 'found original command');
    t.equal(payload.data.metadata.error, '"string error"', 'got correct error');
  });
});

test('test includes data', { skip: iswindows }, function (t) {
  var spy = sinon.spy();
  process.argv = ['node', 'script.js', 'test', 'snyk-demo-app', '-q'];

  var analytics = proxyquire('../src/lib/analytics', {
    './request': spy,
  });

  var cli = proxyquire('../src/cli', {
    '../lib/analytics': analytics,
    './args': proxyquire('../src/cli/args', {
      './commands': proxyquire('../src/cli/commands', {
        '../../lib/hotload': proxyquire('../src/lib/hotload', {
          '../cli/commands/test': proxyquire('../src/lib/snyk-test', {
            './npm': proxyquire('../src/lib/snyk-test/npm', {
              '../../analytics': analytics,
            })
          })
        })
      })
    }),
  });

  return cli.then(function () {
    t.equal(spy.callCount, 1, 'analytics was called');

    var payload = spy.args[0][0].body;
    t.equal(payload.data.command, 'test', 'correct event name');
    t.equal(payload.data.metadata.package, 'snyk-demo-app@*', 'includes package');
  });
});
