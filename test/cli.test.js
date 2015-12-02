'use strict';
require("babel/register")({
  ignore: function (filename) {
    if (filename.indexOf('@snyk/vuln/lib') !== -1) {
      return false;
    }
    if (filename.indexOf('@snyk/registry/test') !== -1) {
      return false;
    }
    if (filename.indexOf('@snyk/registry/lib') !== -1) {
      return false;
    }
    return true;
  },
//  only: /@snyk\/register\//,
});
var test = require('tape');
var apiKey = '123456789';
var oldkey;
var port = process.env.PORT = process.env.SNYK_PORT = 12345;

process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;

var server = require('@snyk/registry/test/fixtures/demo-registry-server');
var db = require('@snyk/registry/lib/models');
var utils = require('@snyk/registry/test/fixtures/utils');

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
var cli = require('../cli/commands');

test('setup', function (t) {
  t.plan(3);
  cli.config('get', 'api').then(function (key) {
    oldkey = key; // just in case
    t.pass('existing user config captured');
  });
  server(port, function () {
    t.pass('started demo server');

    utils.pgSetup().then(function () {
      t.pass('setup pg database');
    });
  });
});

test('prime database', function (t) {
  t.plan(2);

  db.models.User.create({
    ApiKeys: [{
      key: apiKey,
    }, ],
    email: 'test@example.com',
  }, {
    include: [db.models.ApiKey],
  }).then(function () {
    t.pass('demo user created');

    return cli.config('set', 'api=' + apiKey).then(function () {
      t.pass('api key set');
    });
  }).catch(function (err) {
    t.fail(err);
    return t.bailout();
  });
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

test('teardown', function (t) {
  t.plan(3);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  server.app.close(function () {
    t.pass('server shutdown');
    cli.config('set', 'api=' + oldkey).then(function () {
      t.pass('user config restored');
      t.end();
    });
  });
});
