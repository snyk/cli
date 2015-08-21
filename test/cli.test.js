'use strict';
var test = require('tape');
var apiKey = '123456789';
var oldkey;
var port = process.env.PORT = process.env.SNYK_PORT = 12345;

process.env.SNYK_API = 'http://localhost:' + port + '/api/v1'; // jshint ignore:line
process.env.SNYK_HOST = 'http://localhost:' + port;

var server = require('@remy/snyk-registry/test/fixtures/demo-registry-server');

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
var cli = require('../cli/commands');

test('setup', function (t) {
  t.plan(4);
  cli.config('get', 'api').then(function (key) {
    oldkey = key; // just in case
    t.pass('existing user config captured');
  });
  server(port, function () {
    t.pass('started demo server');

    server.db.User.remove(function () {
      t.pass('user db emptied');
    });
    server.db.Vuln.remove(function () {
      t.pass('vulnerabilities db emptied');
    });
  });
});

test('prime database', function (t) {
  t.plan(3);
  // create a user and a vulnerability

  var vulnTest = require('@remy/snyk-registry/test/vuln.test');

  vulnTest.on('end', function () {
    t.pass('vulnerability sub-test completed');
  });

  new server.db.User({
    apiKey: apiKey,
    email: 'test@example.com',
  }).save(function (error) {
    if (error) {
      t.fail(error.message);
      return t.bailout();
    }
    t.pass('demo user created');

    cli.config('set', 'api=' + apiKey).then(function () {
      t.pass('api key set');
    });
  });
});

test('cli', function (t) {
  t.plan(2);

  cli.test('semver@4.0.0').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var pos = res.indexOf('vulnerability found');
    t.ok(pos !== -1, 'correctly found vulnerability');
  });

  cli.config('set', 'api=' + apiKey).then(function () {
    t.pass('user config updated');
  });
});

test('teardown', function (t) {
  t.plan(2);
  server.app.close(function () {
    t.pass('server shutdown');
    cli.config('set', 'api=' + oldkey).then(function () {
      t.pass('user config restored');
      t.end();
    });
  });
});