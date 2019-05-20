var test = require('tap').test;
var sinon = require('sinon');
var apiKey = '123456789';
var oldkey;
var oldendpoint;
var port = process.env.PORT = process.env.SNYK_PORT = 12345;
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = 0;
var server = require('./fake-server')(process.env.SNYK_API, apiKey);
var plugins = require('../../src/lib/plugins');
var config = require('../../src/lib/config');
const origTravisVal = process.env.TRAVIS;
delete process.env.TRAVIS;

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
var cli = require('../../src/cli/commands');

var before = test;
var after = test;

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('setup', function (t) {
  t.plan(3);
  cli.config('get', 'api').then(function (key) {
    oldkey = key;
    t.pass('existing user config captured');
  });

  cli.config('get', 'endpoint').then(function (key) {
    oldendpoint = key;
    t.pass('existing user endpoint captured');
  });

  server.listen(port, function () {
    t.pass('started demo server');
  });
});

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('prime config', function (t) {
  cli.config('set', 'api=' + apiKey).then(function () {
    t.pass('api token set');
  }).then(function () {
    return cli.config('unset', 'endpoint').then(function () {
      t.pass('endpoint removed');
    });
  }).catch(t.bailout).then(t.end);
});

test('`docker suggestion: no Dockerfile + undefined disableSuggestions`', function (t) {
  config.disableSuggestions = undefined;
  chdirWorkspaces();
  return cli.test('ruby-app')
    .then(function (ret) {
      t.pass('test passed');
      t.doesNotHave(ret, 'Consider using Snyk to scan your docker images.',
        'does not show suggestion');
    }).catch(function () {
      t.fail('should not have failed');
    });
});

test('`docker suggestion: --docker + undefined disableSuggestions`', function (t) {
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {
          packageManager: 'deb',
        },
        package: {},
      });
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin')
    .withArgs(sinon.match.any, sinon.match({docker: true}))
    .returns(plugin);
  t.teardown(plugins.loadPlugin.restore);

  config.disableSuggestions = undefined;
  return cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  }).then(function (ret) {
    t.pass('test passed');
    t.doesNotHave(ret, 'Consider using Snyk to scan your docker images.',
      'does not show suggestion');
  }).catch(function () {
    t.fail('should not have failed');
  });
});

test('`docker suggestion: with Dockerfile + disableSuggestions=true`', function (t) {
  config.disableSuggestions = 'true';
  chdirWorkspaces('dockerfile-dir');
  return cli.test('empty', {file: 'Gemfile'})
    .then(function (ret) {
      t.pass('test passed');
      t.doesNotHave(ret, 'Consider using Snyk to scan your docker images.',
        'does not show suggestion');
    }).catch(function () {
      t.fail('should not have failed');
    });
});

test('`docker suggestion: with Dockerfile + no disableSuggestions`', function (t) {
  delete config.disableSuggestions;
  chdirWorkspaces('dockerfile-dir');
  return cli.test('empty', {file: 'Gemfile'})
    .then(function (ret) {
      t.pass('test passed');
      t.includes(ret, 'Consider using Snyk to scan your docker images.',
        'shows suggestion');
    }).catch(function () {
      t.fail('should not have failed');
    });
});

test('`docker suggestion: with Dockerfile + disableSuggestions=false`', function (t) {
  config.disableSuggestions = 'false';
  chdirWorkspaces('dockerfile-dir');
  return cli.test('empty', {file: 'Gemfile'})
    .then(function (ret) {
      t.pass('test passed');
      t.includes(ret, 'Consider using Snyk to scan your docker images.',
        'shows suggestion');
    }).catch(function () {
      t.fail('should not have failed');
    });
});

// @later: try and remove this config stuff
// Was copied straight from ../src/cli-server.js
after('teardown', function (t) {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  config.disableSuggestions = origTravisVal;

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

function chdirWorkspaces(subdir) {
  process.chdir(__dirname + '/workspaces' + (subdir ? '/' + subdir : ''));
}
