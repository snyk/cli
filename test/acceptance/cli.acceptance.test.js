var test = require('tap-only');
var path = require('path');
var proxyquire = require('proxyquire');
var fs = require('fs');
var apiKey = '123456789';
var oldkey;
var oldendpoint;
var port = process.env.PORT = process.env.SNYK_PORT = 12345;
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = 0;
var server = require('./fake-server')(process.env.SNYK_API, apiKey);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
var cli = require('../../cli/commands');

var before = test;
var after = test;

// @later: remove this config stuff.
// Was copied straight from ../cli-server.js
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
// Was copied straight from ../cli-server.js
before('prime config', function (t) {
  cli.config('set', 'api=' + apiKey).then(function () {
    t.pass('api token set');
  }).then(function () {
    return cli.config('unset', 'endpoint').then(function () {
      t.pass('endpoint removed');
    });
  }).catch(t.bailout).then(t.end);
});


/**
 * Remote package `test`
 */

test('`test semver` sends remote NPM request:', function(t) {
  t.plan(2);
  // We care about the request here, not the response
  return cli.test('semver', {registry: 'npm'})
  .then(function() {
    var req = server.popRequest();
    t.equal(req.method, 'GET', 'makes GET request');
    t.match(req.url, '/vuln/npm/semver', 'gets from correct url');
  });
});

test('`test sinatra --registry=rubygems` sends remote Rubygems request:',
function(t) {
  t.plan(2);
  return cli.test('sinatra', {registry: 'rubygems'})
  .then(function() {
    var req = server.popRequest();
    t.equal(req.method, 'GET', 'makes GET request');
    t.match(req.url, '/vuln/rubygems/sinatra', 'gets from correct url');
  });
});

/**
 * Local source `test`
 */

test('`test empty --file=Gemfile`', function(t) {
  t.plan(2);
  chdirWorkspaces();
  return cli.test('empty', {file: 'Gemfile'})
  .catch(function(error) {
    t.pass('throws error');
    t.match(error.message, 'File not found: Gemfile', 'shows error');
  });
});

test('`test ruby-app-no-lockfile --file=Gemfile`', function(t) {
  t.plan(2);
  chdirWorkspaces();
  return cli.test('ruby-app-no-lockfile', {file: 'Gemfile'})
  .catch(function(error) {
    t.pass('throws error');
    t.match(error.message, 'Please run `bundle install`', 'shows error');
  });
});

test('`test ruby-app --file=Gemfile.lock` sends Gemfile and Lockfile',
function(t) {
  t.plan(5);
  chdirWorkspaces();
  return cli.test('ruby-app', {file: 'Gemfile.lock'})
  .then(function() {
    var req = server.popRequest();
    var files = req.body.files;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/rubygems', 'posts to correct url');
    t.equal(req.body.targetFile, 'Gemfile.lock', 'specifies target');
    t.match(decode64(files.gemfile.contents),
      'source :rubygems', 'attaches Gemfile');
    t.match(decode64(files.gemfileLock.contents),
      'remote: http://rubygems.org/', 'attaches Gemfile.lock');
  });
});

test('`test ruby-gem-no-lockfile --file=ruby-gem.gemspec` sends gemspec',
function(t) {
  t.plan(4);
  chdirWorkspaces();
  return cli.test('ruby-gem-no-lockfile', {file: 'ruby-gem.gemspec'})
  .then(function() {
    var req = server.popRequest();
    var files = req.body.files;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/rubygems', 'posts to correct url');
    t.equal(req.body.targetFile, 'ruby-gem.gemspec', 'specifies target');
    t.match(decode64(files.gemspec.contents),
      'Example Gemspec', 'attaches gemspec file');
  });
});

test('`test ruby-gem --file=ruby-gem.gemspec` sends gemspec and Lockfile',
function(t) {
  t.plan(5);
  chdirWorkspaces();
  return cli.test('ruby-gem', {file: 'ruby-gem.gemspec'})
  .then(function() {
    var req = server.popRequest();
    var files = req.body.files;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/rubygems', 'posts to correct url');
    t.equal(req.body.targetFile, 'ruby-gem.gemspec', 'specifies target');
    t.match(decode64(files.gemspec.contents),
      'Example Gemspec', 'attaches gemspec file');
    t.match(decode64(files.gemfileLock.contents),
      'ruby-gem (0.1.0)', 'attaches Gemfile.lock');
  });
});

test('`test ruby-app` auto-detects Gemfile', function(t) {
  t.plan(3);
  chdirWorkspaces();
  return cli.test('ruby-app').then(function() {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/rubygems', 'posts to correct url');
    t.equal(req.body.targetFile, 'Gemfile', 'specifies target');
  });
});

test('`test monorepo --file=sub-ruby-app/Gemfile`', function(t) {
  t.plan(4);
  chdirWorkspaces();
  return cli.test('monorepo', {file: 'sub-ruby-app/Gemfile'}).then(function() {
    var req = server.popRequest();
    var files = req.body.files;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/rubygems', 'posts to correct url');
    t.equal(req.body.targetFile, path.join('sub-ruby-app', 'Gemfile'),
      'specifies target');
    t.equal(files.gemfile.name, path.join('sub-ruby-app', 'Gemfile'),
    'specifies name');
  });
});

test('`test maven-app --file=pom.xml` sends package info',
function(t) {
  t.plan(5);
  chdirWorkspaces();
  var proxiedCLI = proxyMavenExec('maven-app/mvn-dep-tree-stdout.txt');
  return proxiedCLI.test('maven-app', {file: 'pom.xml'})
  .then(function() {
    var req = server.popRequest();
    var pkg = req.body;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/maven', 'posts to correct url');
    t.equal(pkg.artifactId, 'maven-app', 'specifies artifactId');
    t.ok(pkg.dependencies['junit:junit'], 'specifies dependency');
    t.equal(pkg.dependencies['junit:junit'].artifactId, 'junit',
      'specifies dependency artifactId');
  });
});

/**
 * `monitor`
 */

test('`monitor non-existing`', function(t) {
  t.plan(2);
  chdirWorkspaces();
  return cli.monitor('non-existing').catch(function(error) {
    t.pass('throws error');
    t.match(error.message, 'pointed at an existing project', 'shows error');
  });
});

test('`monitor npm-package`', function(t) {
  t.plan(2);
  chdirWorkspaces();
  return cli.monitor('npm-package').then(function() {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/npm', 'puts at correct url');
  });
});

test('`monitor ruby-app`', function(t) {
  t.plan(4);
  chdirWorkspaces();
  return cli.monitor('ruby-app').then(function() {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/rubygems', 'puts at correct url');
    t.equal(req.body.package.targetFile, 'Gemfile', 'specifies target');
    t.match(decode64(req.body.package.files.gemfileLock.contents),
      'remote: http://rubygems.org/', 'attaches Gemfile.lock');
  });
});

test('`monitor maven-app`', function(t) {
  t.plan(5);
  chdirWorkspaces();
  var proxiedCLI = proxyMavenExec('maven-app/mvn-dep-tree-stdout.txt');
  return proxiedCLI.monitor('maven-app', {file: 'pom.xml'}).then(function() {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.equal(pkg.artifactId, 'maven-app', 'specifies artifactId');
    t.ok(pkg.dependencies['junit:junit'], 'specifies dependency');
    t.equal(pkg.dependencies['junit:junit'].artifactId, 'junit',
      'specifies dependency artifactId');
  });
});

/**
 * We can't expect all test environments to have Maven installed
 * So, hijack the system exec call and return the expected output
 */
function proxyMavenExec(execOutputFile) {
  function exec(command, options, callback) {
    var stdout = fs.readFileSync(path.join(execOutputFile), 'utf8');
    callback(null, stdout);
  }
  return proxyquire('../../cli/commands', {
    './monitor': proxyquire('../../cli/commands/monitor', {
      '../../lib/module-info': proxyquire('../../lib/module-info', {
        './maven': proxyquire('../../lib/module-info/maven', {
          'child_process': { 'exec': exec }
        })
      })
    })
  });
}

// @later: try and remove this config stuff
// Was copied straight from ../cli-server.js
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

function chdirWorkspaces() {
  process.chdir(__dirname + '/workspaces');
}

function decode64(str) {
  return new Buffer(str, 'base64').toString('utf8');
}
