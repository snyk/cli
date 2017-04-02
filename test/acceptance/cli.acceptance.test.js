var test = require('tap-only');
var path = require('path');
var fs = require('fs');
var sinon = require('sinon');
var apiKey = '123456789';
var oldkey;
var oldendpoint;
var port = process.env.PORT = process.env.SNYK_PORT = 12345;
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = 0;
var server = require('./fake-server')(process.env.SNYK_API, apiKey);
var subProcess = require('../../lib/sub-process');

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
  t.plan(3);
  // We care about the request here, not the response
  return cli.test('semver', {registry: 'npm', org: 'EFF'})
  .then(function() {
    var req = server.popRequest();
    t.equal(req.method, 'GET', 'makes GET request');
    t.match(req.url, '/vuln/npm/semver', 'gets from correct url');
    t.equal(req.query.org, 'EFF', 'org sent as a query in request');
  });
});

test('`test sinatra --registry=rubygems` sends remote Rubygems request:',
function(t) {
  t.plan(3);
  return cli.test('sinatra', {registry: 'rubygems', org: 'ACME'})
  .then(function() {
    var req = server.popRequest();
    t.equal(req.method, 'GET', 'makes GET request');
    t.match(req.url, '/vuln/rubygems/sinatra', 'gets from correct url');
    t.equal(req.query.org, 'ACME', 'org sent as a query in request');
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
  t.plan(6);
  chdirWorkspaces();
  var stub = stubExec('maven-app/mvn-dep-tree-stdout.txt');
  return cli.test('maven-app', {file: 'pom.xml', org: 'nobelprize.org'})
  .then(function() {
    var req = server.popRequest();
    var pkg = req.body;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/maven', 'posts to correct url');
    t.equal(pkg.artifactId, 'maven-app', 'specifies artifactId');
    t.ok(pkg.dependencies['junit:junit'], 'specifies dependency');
    t.equal(pkg.dependencies['junit:junit'].artifactId, 'junit',
            'specifies dependency artifactId');
    t.equal(req.query.org, 'nobelprize.org', 'org sent as a query in request');

  })
  .catch(function(err) {
    t.error(err);
  })
  .then(function() {
    stub.restore();
  });
});

test('`test` on a yarn package does work and displays appropriate text',
function(t) {
  t.plan(5);
  chdirWorkspaces('yarn-app');
  return cli.test()
  .then(function() {
    var req = server.popRequest();
    var pkg = req.body;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/npm', 'posts to correct url');
    t.equal(pkg.name, 'yarn-app-one', 'specifies package name');
    t.ok(pkg.dependencies.marked, 'specifies dependency');
    t.equal(pkg.dependencies.marked.full, 'marked@0.3.6',
      'specifies dependency full name');
  })
  .catch(function(err) {
    t.error(err);
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
  t.plan(8);
  chdirWorkspaces();
  var stub = stubExec('maven-app/mvn-dep-tree-stdout.txt');
  return cli.monitor('maven-app', {file: 'pom.xml'}).then(function() {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.equal(pkg.artifactId, 'maven-app', 'specifies artifactId');
    t.equal(pkg.from[0],
      'com.mycompany.app:maven-app@1.0-SNAPSHOT',
      'specifies "from" path for root package');
    t.ok(pkg.dependencies['junit:junit'], 'specifies dependency');
    t.equal(pkg.dependencies['junit:junit'].artifactId,
      'junit',
      'specifies dependency artifactId');
    t.equal(pkg.dependencies['junit:junit'].from[0],
      'com.mycompany.app:maven-app@1.0-SNAPSHOT',
      'specifies "from" path for dependencies');
    t.equal(pkg.dependencies['junit:junit'].from[1],
      'junit:junit@3.8.2',
      'specifies "from" path for dependencies');
  })
  .catch(function(err) {
    t.error(err);
  })
  .then(function() {
    stub.restore();
  });
});

test('`monitor maven-multi-app`', function(t) {
  t.plan(7);
  chdirWorkspaces();
  var stub = stubExec('maven-multi-app/mvn-dep-tree-stdout.txt');
  return cli.monitor('maven-multi-app', {file: 'pom.xml'}).then(function() {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.equal(pkg.artifactId, 'maven-multi-app', 'specifies artifactId');
    t.equal(pkg.from[0],
      'com.mycompany.app:maven-multi-app@1.0-SNAPSHOT',
      'specifies "from" path for root package');
    t.ok(pkg.dependencies['com.mycompany.app:simple-child'],
      'specifies dependency');
    t.equal(pkg.dependencies['com.mycompany.app:simple-child'].artifactId,
      'simple-child', 'specifies dependency artifactId');
    t.equal(pkg.dependencies['com.mycompany.app:simple-child'].from[0],
      'com.mycompany.app:maven-multi-app@1.0-SNAPSHOT',
      'specifies root module as first element of "from" path for dependencies');
  })
  .catch(function(err) {
    t.error(err);
  })
  .then(function() {
    stub.restore();
  });
});

test('`monitor yarn-app`', function(t) {
  t.plan(8);
  chdirWorkspaces('yarn-app');
  return cli.monitor().then(function() {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/npm', 'puts at correct url');
    t.equal(pkg.name, 'yarn-app-one', 'specifies name');
    t.equal(pkg.from[0],
      'yarn-app-one@1.0.0',
      'specifies "from" path for root package');
    t.ok(pkg.dependencies.marked, 'specifies dependency');
    t.equal(pkg.dependencies.marked.full,
      'marked@0.3.6', 'specifies dependency full name');
    t.equal(pkg.dependencies.marked.from[0],
      'yarn-app-one@1.0.0',
      'specifies root module as first element of "from" path for dependencies');
    t.equal(pkg.dependencies.marked.from[1],
      'marked@0.3.6',
      'specifies dependency module as second element of "from" path for dependencies');
  })
  .catch(function(err) {
    t.error(err);
  });
});

/**
 * We can't expect all test environments to have Maven installed
 * So, hijack the system exec call and return the expected output
 */
function stubExec(execOutputFile) {
  function execute() {
    var stdout = fs.readFileSync(path.join(execOutputFile), 'utf8');
    return Promise.resolve({stdout: stdout});
  }
  return sinon.stub(subProcess, 'execute', execute);
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

function chdirWorkspaces(subdir) {
  process.chdir(__dirname + '/workspaces' + (subdir ? '/' + subdir : ''));
}

function decode64(str) {
  return new Buffer(str, 'base64').toString('utf8');
}
