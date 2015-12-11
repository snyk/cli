require('babel/register')({
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
var chalk = require('chalk');
var port = process.env.PORT = process.env.SNYK_PORT = 12345;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var parse = require('url').parse;
var Promise = require('es6-promise').Promise; // jshint ignore:line

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

test.skip('cli', function (t) {
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

test.skip('monitor', function (t) {
  t.plan(1);

  cli.monitor().then(function () {
    t.pass('monitor captured');
  }).catch(function (error) {
    t.fail(error);
  });
});

test.skip('multiple test arguments', function (t) {
  t.plan(1);

  cli.test('semver@2', 'jsbin@3.11.23').then(function (res) {
    t.fail(res);
  }).catch(function (error) {
    var res = error.message;
    var lastLine = res.trim().split('\n').pop();
    t.equals(lastLine.indexOf('Tested 2 projects'), 0, 'successfully tested 2 projects');
  });
});

test.skip('auth via key', function (t) {
  t.plan(1);

  var spy = sinon.spy(function (req, callback) {
    process.nextTick(function () {
      var body = {
        ok: true,
        api: req.body.api,
      };
      callback(null, {
        statusCode: 200,
        body: body,
      }, body);
    });
  });

  var auth = proxyquire('../cli/commands/auth', {
    '../../lib/request': spy,
  });

  auth(apiKey).then(function (res) {
    t.notEqual(res.toLowerCase().indexOf('ready'), -1, 'snyk auth worked');
  }).catch(function (e) {
    console.log(e.stack);
    t.fail(e);
  });
});

test.skip('auth via invalid key', function (t) {
  t.plan(1);

  var errors = require('../lib/error');

  var spy = sinon.spy(function (req, callback) {
    process.nextTick(function () {
      var body = {
        ok: false,
      };
      callback(null, {
        statusCode: 401,
        body: body,
      }, body);
    });
  });

  var auth = proxyquire('../cli/commands/auth', {
    '../../lib/request': spy,
  });

  auth('_____________').then(function (res) {
    t.fail('auth should not succeed: ' + res);
  }).catch(function (e) {
    var message = chalk.stripColor(errors.message(e));
    t.equal(message.toLowerCase().indexOf('authentication failed'), 0, 'captured failed auth');
  });
});

test.skip('auth via github', function (t) {
  t.plan(1);

  var tokenRequest = null;

  var openSpy = sinon.spy(function (url) {
    tokenRequest = parse(url);
    tokenRequest.token = tokenRequest.query.split('=').pop();
  });

  var spy = sinon.spy(function (req, callback) {
    process.nextTick(function () {
      var body = {};

      if (tokenRequest !== null) {
        if (req.body.token === tokenRequest.token) {
          body.api = apiKey;
        }
      }

      callback(null, {
        statusCode: 200,
        body: body,
      }, body);
    });
  });

  var auth = proxyquire('../cli/commands/auth', {
    '../../lib/request': spy,
    'open': openSpy
  });

  auth().then(function (res) {
    t.notEqual(res.toLowerCase().indexOf('ready'), -1, 'snyk auth worked');
  }).catch(function (e) {
    t.fail(e);
  });
});

test('wizard and multi-patch', function (t) {

  var authSpy = sinon.spy(function (req, callback) {
    process.nextTick(function () {
      var body = {
        ok: true,
        api: req.body.api,
      };
      callback(null, {
        statusCode: 200,
        body: body,
      }, body);
    });
  });

  var auth = proxyquire('../cli/commands/auth', {
    '../../lib/request': authSpy
  });

  var vulns = require('./fixtures/uglify-contrived.json');
  var answers = require('./fixtures/wizard-patch-answers.json');

  var wizard = proxyquire('../cli/commands/protect/wizard', {
    '../../../lib/': {
      test: function () {
        return Promise.resolve(vulns);
      }
    },
    inquirer: {
      prompt: function (questions, callback) {
        if (questions.name === 'misc-start-over') {
          return callback({ 'misc-start-over': false });
        }

        return callback(answers);
      },
    },
  });

  var cwd = process.cwd();
  process.chdir(__dirname + '/fixtures/uglify-package');
  wizard().then(function () {
    t.pass('ok');
  }).catch(function (e) {
    t.fail(e);
  }).then(function () {
    process.chdir(cwd);
    t.end();
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
    var key = 'set';
    var value = 'api=' + oldkey;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    cli.config(key, value).then(function () {
      t.pass('user config restored');
      t.end();
    });
  });
});
