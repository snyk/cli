var test = require('tap-only');
var testUtils = require('./utils');
var apiKey = '123456789';
var oldkey;
var oldendpoint;
var chalk = require('chalk');
var port = process.env.PORT = process.env.SNYK_PORT = 12345;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var parse = require('url').parse;

process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = 0;


var server = require('./cli-server')(process.env.SNYK_API, apiKey);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
var cli = require('../cli/commands');

var before = test;
var after = test;

before('setup', function (t) {
  t.plan(3);
  cli.config('get', 'api').then(function (key) {
    oldkey = key; // just in case
    t.pass('existing user config captured');
  });

  cli.config('get', 'endpoint').then(function (key) {
    oldendpoint = key; // just in case
    t.pass('existing user endpoint captured');
  });

  server.listen(port, function () {
    t.pass('started demo server');
  });
});

before('prime config', function (t) {
  cli.config('set', 'api=' + apiKey).then(function () {
    t.pass('api token set');
  }).then(function () {
    return cli.config('unset', 'endpoint').then(function () {
      t.pass('endpoint removed');
    });
  }).catch(t.bailout).then(t.end);
});

test('cli', function (t) {
  t.plan(2);

  cli.test('semver@2').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var pos = res.toLowerCase().indexOf('vulnerability found');
    t.pass(res);
    t.notEqual(pos, -1, 'correctly found vulnerability: ' + res);
  });

});

test('monitor', function (t) {
  t.plan(1);

  cli.monitor().then(function () {
    t.pass('monitor captured');
  }).catch(function (error) {
    t.fail(error);
  });
});

test('multiple test arguments', function (t) {
  t.plan(1);

  cli.test('semver@2', 'jsbin@3.11.23').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var lastLine = res.trim().split('\n').pop();
    t.equals(lastLine.indexOf('Tested 2 projects'), 0, 'successfully tested 2 projects');
  });
});

test('test without authentication', function (t) {
  t.plan(1);
  return cli.config('unset', 'api').then(function () {
    return cli.test('semver@2');
  }).then(function (res) {
    t.fail('test should not pass if not authenticated');
  }).catch(function (error) {
    t.equals(error.code, 'NO_API_TOKEN', 'test requires authentication');
  })
  .then(function () {
    return cli.config('set', 'api=' + apiKey);
  });
});

test('auth via key', function (t) {
  t.plan(1);

  cli.auth(apiKey).then(function (res) {
    t.notEqual(res.toLowerCase().indexOf('ready'), -1, 'snyk auth worked');
  }).catch(t.threw);
});

test('auth via invalid key', function (t) {
  t.plan(1);

  var errors = require('../lib/error');

  cli.auth('_____________').then(function (res) {
    t.fail('auth should not succeed: ' + res);
  }).catch(function (e) {
    var message = chalk.stripColor(errors.message(e));
    t.equal(message.toLowerCase().indexOf('authentication failed'), 0, 'captured failed auth');
  });
});

test('auth via github', function (t) {
  var tokenRequest = null;

  var openSpy = sinon.spy(function (url) {
    tokenRequest = parse(url);
    tokenRequest.token = tokenRequest.query.split('=').pop();
  });

  var auth = proxyquire('../cli/commands/auth', {
    'open': openSpy,
    '../../lib/is-ci': false,
  });

  var unhook = testUtils.silenceLog();

  auth().then(function (res) {
    t.notEqual(res.toLowerCase().indexOf('ready'), -1, 'snyk auth worked');
  }).catch(t.threw).then(function () {
    unhook();
    t.end();
  });
});

after('teardown', function (t) {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  server.close(function () {
    t.pass('server shutdown');
    var key = 'set';
    var value = 'api=' + oldkey;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    cli.config(key, value).then(function () {
      t.pass('user config restored');
      if (oldendpoint) {
        cli.config('endpoint', oldendpoint).then(function () {
          t.pass('user endpoint restored');
          t.end();
        });
      } else {
        t.pass('no endpoint');
        t.end();
      }
    });


  });
});
