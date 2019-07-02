var _ = require('lodash');
var test = require('tap').test;
var testUtils = require('../utils');
var ciChecker = require('../../src/lib/is-ci');
var apiKey = '123456789';
var notAuthorizedApiKey = 'notAuthorized';
var oldkey;
var oldendpoint;
var port = process.env.PORT || process.env.SNYK_PORT || '12345';
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var parse = require('url').parse;
var policy = require('snyk-policy');
const stripAnsi = require('strip-ansi');

process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';


var server = require('../cli-server')(
  process.env.SNYK_API, apiKey, notAuthorizedApiKey
);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
var cli = require('../../src/cli/commands');

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

test('cli tests for online repos', function (t) {
  t.plan(4);

  cli.test('semver@2').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var pos = res.toLowerCase().indexOf('vulnerability found');
    t.pass(res);
    t.notEqual(pos, -1, 'correctly found vulnerability: ' + res);
  });

  cli.test('semver@2', {json: true}).then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = JSON.parse(error.message);
    var vuln = res.vulnerabilities[0];
    t.pass(vuln.title);
    t.equal(vuln.id, 'npm:semver:20150403',
      'correctly found vulnerability: ' + vuln.id);
  });
});

test('multiple test arguments', function (t) {
  t.plan(4);

  cli.test('semver@4', 'qs@6').then(function (res) {
    var lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, no vulnerable paths were found.',
      'successfully tested semver@4, qs@6');
  }).catch(function (error) {
    t.fail(error);
  });

  cli.test('semver@4', 'qs@1').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@4, qs@1');
  });

  cli.test('semver@2', 'qs@6').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@2, qs@6');
  });

  cli.test('semver@2', 'qs@1').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var lastLine = res.trim().split('\n').pop();
    t.equals(lastLine, 'Tested 2 projects, 2 contained vulnerable paths.',
      'successfully tested semver@2, qs@1');
  });
});

test('test for non-existing', function (t) {
  t.plan(1);

  cli.test('@123').then(function (res) {
    t.fails('should fail, instead received ' + res);
  }).catch(function (error) {
    t.match(error.message, '500', 'expected error ' + error.message)
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
