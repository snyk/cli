var test = require('tap').test;
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
var subProcess = require('../../src/lib/sub-process');
var plugins = require('../../src/lib/plugins');
var needle = require('needle');

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
var cli = require('../../src/cli/commands');
var snykPolicy = require('snyk-policy');

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

test('test cli with multiple params: good and bad', function (t) {
  t.plan(6);
  return cli.test('/', 'semver', {registry: 'npm', org: 'EFF', json: true})
  .then(function () {
    t.fail('expect to error');
  }).catch(function (error) {
    var errObj = JSON.parse(error.message);
    t.ok(errObj.length == 2, 'expecting two results');
    t.notOk(errObj[0].ok, 'first object shouldnt be ok');
    t.ok(errObj[1].ok, 'second object should be ok');
    t.ok(errObj[0].path.length > 0, 'should have path');
    t.ok(errObj[1].path.length > 0, 'should have path');
    t.pass('info on both objects');
  });
});

test('userMessage correctly bubbles with npm', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package', {org: 'missing-org'})
    .then(function () {
      t.fail('expect to error');
    }).catch(function (error) {
      t.equal(error.userMessage, 'cli error message', 'got correct error message');
    });
});

test('userMessage correctly bubbles with everything other than npm', function (t) {
  chdirWorkspaces();
  return cli.test('ruby-app', { org: 'missing-org' })
    .then(function () {
      t.fail('expect to error');
    }).catch(function (error) {
      t.equal(error.userMessage, 'cli error message', 'got correct error message');
    });
});

/**
 * Remote package `test`
 */

test('`test semver` sends remote NPM request:', function (t) {
  t.plan(3);
  // We care about the request here, not the response
  return cli.test('semver', {registry: 'npm', org: 'EFF'})
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'GET', 'makes GET request');
    t.match(req.url, '/vuln/npm/semver', 'gets from correct url');
    t.equal(req.query.org, 'EFF', 'org sent as a query in request');
  });
});

test('`test sinatra --registry=rubygems` sends remote Rubygems request:',
function (t) {
  return cli.test('sinatra', {registry: 'rubygems', org: 'ACME'})
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'GET', 'makes GET request');
    t.match(req.url, '/vuln/rubygems/sinatra', 'gets from correct url');
    t.equal(req.query.org, 'ACME', 'org sent as a query in request');
  });
});

/**
 * Local source `test`
 */

test('`test empty --file=Gemfile`', function (t) {
  chdirWorkspaces();
  return cli.test('empty', {file: 'Gemfile'})
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    t.pass('throws error');
    t.match(error.message, 'Could not find the specified file: Gemfile',
      'shows error');
  });
});

test('`test --file=fixtures/protect/package.json`', function (t) {
  return cli.test(
    path.resolve(__dirname, '..'),
    {file: 'fixtures/protect/package.json'}
  ).then(function (res) {
    t.match(
      res,
      /Tested 1 dependencies for known vulnerabilities/,
      'should succeed in a folder',
    );
  }).catch((err) => t.throws(err, 'should succeed'));
});

test('`test /` test for non-existent with path specified', function (t) {
  chdirWorkspaces();
  return cli.test('/')
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    t.pass('throws error');
    t.match(error.message, 'Could not detect supported target files in /.' +
    '\nPlease see our documentation for supported' +
    ' languages and target files: ' +
    'https://support.snyk.io/getting-started/languages-support' +
    ' and make sure you' +
    ' are in the right directory.');
  });
});

test('`test nuget-app --file=non_existent`', function (t) {
  chdirWorkspaces();
  return cli.test('nuget-app', {file: 'non-existent'})
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    t.pass('throws error');
    t.match(error.message, 'Could not find the specified file: non-existent',
      'show first part of error message')
    t.match(error.message, 'Please check that it exists and try again.',
    'show second part of error message')
  });
});

test('`test empty --file=readme.md`', function (t) {
  chdirWorkspaces();
  return cli.test('empty', {file: 'readme.md'})
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    t.pass('throws error');
    t.match(error.message,
      'Could not detect package manager for file: readme.md',
      'shows error message for when file specified exists, but not supported');
  });
});

test('`test ruby-app-no-lockfile --file=Gemfile`', function (t) {
  chdirWorkspaces();
  return cli.test('ruby-app-no-lockfile', {file: 'Gemfile'})
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    t.pass('throws error');
    t.match(error.message, 'Please run `bundle install`', 'shows error');
  });
});

test('`test ruby-app --file=Gemfile.lock` sends Gemfile and Lockfile',
function (t) {
  chdirWorkspaces();
  return cli.test('ruby-app', {file: 'Gemfile.lock'})
  .then(function () {
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

test('`test ruby-app` returns correct meta', function (t) {
  chdirWorkspaces();
  return cli.test('ruby-app')
  .then(function (res) {
    var meta = res.slice(res.indexOf('Organisation:')).split('\n');
    t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
    t.match(meta[1], /Package manager:\s+rubygems/,
      'package manager displayed');
    t.match(meta[2], /Target file:\s+Gemfile/, 'target file displayed');
    t.match(meta[3], /Open source:\s+no/, 'open source displayed');
    t.match(meta[4], /Project path:\s+ruby-app/, 'path displayed');
    t.notMatch(meta[5], /Local Snyk policy:\s+found/,
      'local policy not displayed');
  });
});

test('`test gradle-app` returns correct meta', function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');
  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin.withArgs('gradle').returns(plugin);

  return cli.test('gradle-app')
  .then(function (res) {
    var meta = res.slice(res.indexOf('Organisation:')).split('\n');
    t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
    t.match(meta[1], /Package manager:\s+gradle/,
      'package manager displayed');
    t.match(meta[2], /Target file:\s+build.gradle/, 'target file displayed');
    t.match(meta[3], /Open source:\s+no/, 'open source displayed');
    t.match(meta[4], /Project path:\s+gradle-app/, 'path displayed');
    t.notMatch(meta[5], /Local Snyk policy:\s+found/,
      'local policy not displayed');
  });
});

test('`test` returns correct meta for a vulnerable result', function (t) {
  chdirWorkspaces();
  return cli.test('ruby-app', { org: 'org-with-vulns' })
  .catch(function (res) {
    var meta = res.message.slice(res.message.indexOf('Organisation:'))
      .split('\n');
    t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
    t.match(meta[1], /Package manager:\s+rubygems/,
      'package manager displayed');
    t.match(meta[2], /Target file:\s+Gemfile/, 'target file displayed');
    t.match(meta[3], /Open source:\s+no/, 'open source displayed');
    t.match(meta[4], /Project path:\s+ruby-app/, 'path displayed');
    t.notMatch(meta[5], /Local Snyk policy:\s+found/,
      'local policy not displayed');
  });
});

test('`test` returns correct meta when target file specified', function (t) {
  chdirWorkspaces();
  return cli.test('ruby-app', {file: 'Gemfile.lock'})
  .then(function (res) {
    var meta = res.slice(res.indexOf('Organisation:')).split('\n');
    t.match(meta[2], /Target file:\s+Gemfile.lock/, 'target file displayed');
  });
});

test('`test npm-package-policy` returns correct meta', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package-policy')
  .then(function (res) {
    var meta = res.slice(res.indexOf('Organisation:')).split('\n');
    t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
    t.match(meta[1], /Package manager:\s+npm/, 'package manager displayed');
    t.match(meta[2], /Target file:\s+package.json/, 'target file displayed');
    t.match(meta[3], /Open source:\s+no/, 'open source displayed');
    t.match(meta[4], /Project path:\s+npm-package-policy/, 'path displayed');
    t.match(meta[5], /Local Snyk policy:\s+found/, 'local policy displayed');
  });
});


test('`test ruby-gem-no-lockfile --file=ruby-gem.gemspec` sends gemspec',
function (t) {
  chdirWorkspaces();
  return cli.test('ruby-gem-no-lockfile', {file: 'ruby-gem.gemspec'})
  .then(function () {
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
function (t) {
  chdirWorkspaces();
  return cli.test('ruby-gem', {file: 'ruby-gem.gemspec'})
  .then(function () {
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

test('`test ruby-app` auto-detects Gemfile', function (t) {
  chdirWorkspaces();
  return cli.test('ruby-app')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/rubygems', 'posts to correct url');
    t.equal(req.body.targetFile, 'Gemfile', 'specifies target');
  });
});


test('`test nuget-app-2 auto-detects project.assets.json`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('nuget')
  .returns(plugin);

  return cli.test('nuget-app-2')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/nuget', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['nuget-app-2', 'project.assets.json', {
        args: null,
        file: 'project.assets.json',
        org: null,
        packageManager: 'nuget',
        path: 'nuget-app-2',
        showVulnPaths: true,
      },], 'calls nuget plugin');
  });
});

test('`test nuget-app-2.1 auto-detects obj/project.assets.json`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('nuget')
  .returns(plugin);

  return cli.test('nuget-app-2.1')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/nuget', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['nuget-app-2.1', 'obj/project.assets.json', {
        args: null,
        file: 'obj/project.assets.json',
        org: null,
        packageManager: 'nuget',
        path: 'nuget-app-2.1',
        showVulnPaths: true,
      },], 'calls nuget plugin');
  });
});


test('`test nuget-app-4 auto-detects packages.config`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('nuget')
  .returns(plugin);

  return cli.test('nuget-app-4')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/nuget', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['nuget-app-4', 'packages.config', {
        args: null,
        file: 'packages.config',
        org: null,
        packageManager: 'nuget',
        path: 'nuget-app-4',
        showVulnPaths: true,
      },], 'calls nuget plugin');
  });
});

test('`test monorepo --file=sub-ruby-app/Gemfile`', function (t) {
  chdirWorkspaces();
  return cli.test('monorepo', {file: 'sub-ruby-app/Gemfile'})
  .then(function () {
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

test('`test maven-app --file=pom.xml --dev` sends package info',
function (t) {
  chdirWorkspaces();
  stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
  return cli.test('maven-app',
    {file: 'pom.xml', org: 'nobelprize.org', dev: true})
  .then(function () {
    var req = server.popRequest();
    var pkg = req.body;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/maven', 'posts to correct url');
    t.equal(pkg.name, 'com.mycompany.app:maven-app', 'specifies name');
    t.ok(pkg.dependencies['axis:axis'], 'specifies dependency');
    t.ok(pkg.dependencies['junit:junit'], 'specifies dependency');
    t.equal(pkg.dependencies['junit:junit'].name, 'junit:junit',
            'specifies dependency name');
    t.equal(req.query.org, 'nobelprize.org', 'org sent as a query in request');
  });
});

test('`test npm-package` sends pkg info', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package')
  .then(function () {
    var req = server.popRequest();
    var pkg = req.body;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/npm', 'posts to correct url');
    t.ok(pkg.dependencies['debug'], 'dependency');
    t.ok(pkg.dependencies['debug'].dependencies['ms'], 'transitive dependency');
    t.notOk(pkg.dependencies['object-assign'],
      'no dev dependency');
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(pkg.dependencies['debug'].from,
      'no "from" array on dep');
  });
});

test('`test npm-package --file=package-lock.json ` sends pkg info', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package', {file: 'package-lock.json'})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(req.method, 'POST', 'makes POST request');
      t.match(req.url, '/vuln/npm', 'posts to correct url');
      t.ok(pkg.dependencies['debug'], 'dependency');
      t.ok(pkg.dependencies['debug'].dependencies['ms'], 'transitive dependency');
      t.notOk(pkg.dependencies['object-assign'],
        'no dev dependency');
      t.notOk(pkg.from, 'no "from" array on root');
      t.notOk(pkg.dependencies['debug'].from,
        'no "from" array on dep');
    });
});

test('`test npm-package --file=package-lock.json --dev` sends pkg info', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package', {file: 'package-lock.json', dev: true})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(req.method, 'POST', 'makes POST request');
      t.match(req.url, '/vuln/npm', 'posts to correct url');
      t.ok(pkg.dependencies['debug'], 'dependency');
      t.ok(pkg.dependencies['debug'].dependencies['ms'], 'transitive dependency');
      t.ok(pkg.dependencies['object-assign'],
        'dev dependency included');
      t.notOk(pkg.from, 'no "from" array on root');
      t.notOk(pkg.dependencies['debug'].from,
        'no "from" array on dep');
    });
});

test('`test npm-package-shrinkwrap --file=package-lock.json ` with npm-shrinkwrap errors', function (t) {
  t.plan(1);
  chdirWorkspaces();
  return cli.test('npm-package-shrinkwrap', {file: 'package-lock.json'})
    .catch((e) => {
      t.includes(e.message, '--file=package-lock.json', 'Contains enough info about error');
    });
});

test('`test npm-package-with-subfolder --file=package-lock.json ` picks top-level files', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package-with-subfolder', {file: 'package-lock.json'})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(pkg.name, 'npm-package-top-level', 'correct package is taken');
      t.ok(pkg.dependencies['to-array'], 'dependency');
    });
});

test('`test npm-package-with-subfolder --file=subfolder/package-lock.json ` picks subfolder files', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package-with-subfolder', {file: 'subfolder/package-lock.json'})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(pkg.name, 'npm-package-subfolder', 'correct package is taken');
      t.ok(pkg.dependencies['to-array'], 'dependency');
    });
});

test('`test npm-package --file=yarn.lock ` sends pkg info', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package', {file: 'yarn.lock'})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(req.method, 'POST', 'makes POST request');
      t.match(req.url, '/vuln/npm', 'posts to correct url');
      t.ok(pkg.dependencies['debug'], 'dependency');
      t.ok(pkg.dependencies['debug'].dependencies['ms'], 'transitive dependency');
      t.notOk(pkg.dependencies['object-assign'],
        'no dev dependency');
      t.notOk(pkg.from, 'no "from" array on root');
      t.notOk(pkg.dependencies['debug'].from,
        'no "from" array on dep');
    });
});

test('`test npm-package --file=yarn.lock --dev` sends pkg info', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package', {file: 'yarn.lock', dev: true})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(req.method, 'POST', 'makes POST request');
      t.match(req.url, '/vuln/npm', 'posts to correct url');
      t.ok(pkg.dependencies['debug'], 'dependency');
      t.ok(pkg.dependencies['debug'].dependencies['ms'], 'transitive dependency');
      t.ok(pkg.dependencies['object-assign'],
        'dev dependency included');
      t.notOk(pkg.from, 'no "from" array on root');
      t.notOk(pkg.dependencies['debug'].from,
        'no "from" array on dep');
    });
});

test('`test npm-package-with-subfolder --file=yarn.lock ` picks top-level files', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package-with-subfolder', {file: 'yarn.lock'})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(pkg.name, 'npm-package-top-level', 'correct package is taken');
      t.ok(pkg.dependencies['to-array'], 'dependency');
    });
});

test('`test npm-package-with-subfolder --file=subfolder/yarn.lock ` picks subfolder files', function (t) {
  chdirWorkspaces();
  return cli.test('npm-package-with-subfolder', {file: 'subfolder/yarn.lock'})
    .then(function () {
      var req = server.popRequest();
      var pkg = req.body;
      t.equal(pkg.name, 'npm-package-subfolder', 'correct package is taken');
      t.ok(pkg.dependencies['to-array'], 'dependency');
    });
});

test('`test` on a yarn package does work and displays appropriate text',
function (t) {
  chdirWorkspaces('yarn-app');
  return cli.test()
  .then(function () {
    var req = server.popRequest();
    var pkg = req.body;
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/npm', 'posts to correct url');
    t.equal(pkg.name, 'yarn-app-one', 'specifies package name');
    t.ok(pkg.dependencies.marked, 'specifies dependency');
    t.equal(pkg.dependencies.marked.name,
      'marked', 'marked dep name');
    t.equal(pkg.dependencies.marked.version,
      '0.3.6', 'marked dep version');
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(pkg.dependencies.marked.from,
      'no "from" array on dep');
  });
});

test('`test pip-app --file=requirements.txt`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('pip')
  .returns(plugin);

  return cli.test('pip-app', {
    file: 'requirements.txt',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/pip', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['pip-app', 'requirements.txt', {
        args: null,
        file: 'requirements.txt',
        org: null,
        packageManager: 'pip',
        path: 'pip-app',
        showVulnPaths: true,
      }], 'calls python plugin');
  });
});

test('`test pipenv-app --file=Pipfile`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('pip')
  .returns(plugin);

  return cli.test('pipenv-app', {
    file: 'Pipfile',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/pip', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['pipenv-app', 'Pipfile', {
        args: null,
        file: 'Pipfile',
        org: null,
        packageManager: 'pip',
        path: 'pipenv-app',
        showVulnPaths: true,
      }], 'calls python plugin');
  });
});

test('`test nuget-app --file=project.assets.json`', function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('nuget')
  .returns(plugin);

  return cli.test('nuget-app', {
    file: 'project.assets.json',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/nuget', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['nuget-app', 'project.assets.json', {
        args: null,
        file: 'project.assets.json',
        org: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: true,
      },], 'calls nuget plugin');
  });
});

test('`test nuget-app --file=packages.config`', function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('nuget')
  .returns(plugin);

  return cli.test('nuget-app', {
    file: 'packages.config',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/nuget', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['nuget-app', 'packages.config', {
        args: null,
        file: 'packages.config',
        org: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: true,
      },], 'calls nuget plugin');
  });
});

test('`test nuget-app --file=project.json`', function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('nuget')
  .returns(plugin);

  return cli.test('nuget-app', {
    file: 'project.json',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/nuget', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['nuget-app', 'project.json', {
        args: null,
        file: 'project.json',
        org: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: true,
      },], 'calls nuget plugin');
  });
});

test('`test golang-app --file=Gopkg.lock`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('golangdep')
  .returns(plugin);

  return cli.test('golang-app', {
    file: 'Gopkg.lock',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/golangdep', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['golang-app', 'Gopkg.lock', {
        args: null,
        file: 'Gopkg.lock',
        org: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: true,
      },], 'calls golang plugin');
  });
});

test('`test golang-app --file=vendor/vendor.json`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('govendor')
  .returns(plugin);

  return cli.test('golang-app', {
    file: 'vendor/vendor.json',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/govendor', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['golang-app', 'vendor/vendor.json', {
        args: null,
        file: 'vendor/vendor.json',
        org: null,
        packageManager: 'govendor',
        path: 'golang-app',
        showVulnPaths: true,
      },], 'calls golang plugin');
  });
});

test('`test golang-app` auto-detects golang/dep',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('golangdep')
  .returns(plugin);

  return cli.test('golang-app')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/golangdep', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['golang-app', 'Gopkg.lock', {
        args: null,
        file: 'Gopkg.lock',
        org: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: true,
      },], 'calls golang plugin');
  });
});

test('`test golang-app-govendor` auto-detects govendor',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('govendor')
  .returns(plugin);

  return cli.test('golang-app-govendor')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/govendor', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['golang-app-govendor', 'vendor/vendor.json', {
        args: null,
        file: 'vendor/vendor.json',
        org: null,
        packageManager: 'govendor',
        path: 'golang-app-govendor',
        showVulnPaths: true,
      },], 'calls golang plugin');
  });
});

test('`test composer-app --file=composer.lock`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('composer')
  .returns(plugin);

  return cli.test('composer-app', {
    file: 'composer.lock',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/composer', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['composer-app', 'composer.lock', {
        args: null,
        file: 'composer.lock',
        org: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: true,
      },], 'calls composer plugin');
  });
});

test('`test composer-app` auto-detects composer.lock', function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('composer')
  .returns(plugin);

  return cli.test('composer-app')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/composer', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['composer-app', 'composer.lock', {
        args: null,
        file: 'composer.lock',
        org: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: true,
      },], 'calls composer plugin');
  });
});

test('`test composer-app` auto-detects composer.lock',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('composer')
  .returns(plugin);

  return cli.test('composer-app')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/composer', 'posts to correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['composer-app', 'composer.lock', {
        args: null,
        file: 'composer.lock',
        org: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: true,
      },], 'calls composer plugin');
  });
});

test('`test composer-app golang-app nuget-app` auto-detects all three projects',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({package: {}});
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin.withArgs('composer').returns(plugin);
  plugins.loadPlugin.withArgs('golangdep').returns(plugin);
  plugins.loadPlugin.withArgs('nuget').returns(plugin);

  return cli.test('composer-app', 'golang-app', 'nuget-app', {org: 'test-org'})
  .then(function () {
    // assert three API calls made, each with a different url
    var reqs = Array.from({length:3})
      .map(function () { return server.popRequest(); });

    t.same(reqs.map(function (r) { return r.method; }),
      ['POST', 'POST', 'POST'], 'all post requests');

    t.same(reqs.map(function (r) { return r.url; }).sort(), [
      '/api/v1/vuln/composer?org=test-org',
      '/api/v1/vuln/golangdep?org=test-org',
      '/api/v1/vuln/nuget?org=test-org',
    ], 'all urls are present');

    // assert three plugin.inspect calls, each with a different app
    var calls = plugin.inspect.getCalls().sort(function (call1, call2) {
      return call1.args[0] < call2.args[1] ? -1 :
              (call1.args[0] > call2.args[0] ? 1 : 0);
    });
    t.same(calls[0].args,
      ['composer-app', 'composer.lock', {
        args: null,
        org: 'test-org',
        file: 'composer.lock',
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: true,
      },], 'calls composer plugin');
    t.same(calls[1].args,
      ['golang-app', 'Gopkg.lock', {
        args: null,
        org: 'test-org',
        file: 'Gopkg.lock',
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: true,
      },], 'calls golangdep plugin');
    t.same(calls[2].args,
      ['nuget-app', 'project.assets.json', {
        args: null,
        org: 'test-org',
        file: 'project.assets.json',
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: true,
      },], 'calls nuget plugin');
  });
});

test('`test foo:latest --docker`',
function (t) {
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

  return cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/deb',
      'posts to correct url (uses package manager from plugin response)');
    t.same(plugin.inspect.getCall(0).args,
      ['foo:latest', null, {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: true,
      }], 'calls docker plugin with expected arguments');
  });
});

test('`test foo:latest --docker vulnerable paths`',
function (t) {
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

  var vulns = require('./fixtures/docker/vulns.json');
  server.setNextResponse(vulns);

  return cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  })
  .catch(function (res) {
    var req = server.popRequest();
    t.false(res.message.includes('vulnerable paths'),
     'docker should not includes number of vulnerable paths');
  });
});

test('`test foo:latest --docker --file=Dockerfile`',
function (t) {
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {
          packageManager: 'deb',
        },
        package: {
          docker: {
            baseImage: 'ubuntu:14.04',
          },
        },
      });
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin')
    .withArgs(sinon.match.any, sinon.match({docker: true}))
    .returns(plugin);
  t.teardown(plugins.loadPlugin.restore);

  return cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    file: 'Dockerfile',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/deb',
      'posts to correct url (uses package manager from plugin response)');
    t.equal(req.body.docker.baseImage, 'ubuntu:14.04',
      'posts docker baseImage');
    t.same(plugin.inspect.getCall(0).args,
      ['foo:latest', 'Dockerfile', {
        args: null,
        file: 'Dockerfile',
        docker: true,
        org: 'explicit-org',
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: true,
      }], 'calls docker plugin with expected arguments');
  });
});

test('`test foo:latest --docker` doesnt collect policy from cwd',
function (t) {
  chdirWorkspaces('npm-package-policy');
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

  return cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/deb',
      'posts to correct url (uses package manager from plugin response)');
    t.same(plugin.inspect.getCall(0).args,
      ['foo:latest', null, {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: true,
      }], 'calls docker plugin with expected arguments');
    var policyString = req.body.policy;
    t.false(policyString, 'policy not sent');
  });
});

test('`test foo:latest --docker` supports custom policy',
function (t) {
  chdirWorkspaces();
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

  return cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    'policy-path': 'npm-package-policy/custom-location',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/vuln/deb',
      'posts to correct url (uses package manager from plugin response)');
    t.same(plugin.inspect.getCall(0).args,
      ['foo:latest', null, {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: true,
        'policy-path': 'npm-package-policy/custom-location',
      }], 'calls docker plugin with expected arguments');

    var expected = fs.readFileSync(
      path.join('npm-package-policy/custom-location', '.snyk'),
      'utf8');
    var policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');
  });
});

test('`test --policy-path`', function (t) {
  t.plan(3);

  t.test('default policy', function (t) {
    chdirWorkspaces('npm-package-policy');
    var expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    var vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    return cli.test('.', {
      json: true,
    })
    .then(function () {
      t.fail('should have reported vulns');
    })
    .catch(function (res) {
      var req = server.popRequest();
      var policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');

      var output = JSON.parse(res.message);
      var ignore = output.filtered.ignore;
      var vulnerabilities = output.vulnerabilities;
      t.equal(ignore.length, 1, 'one ignore rule');
      t.equal(ignore[0].id, 'npm:marked:20170907', 'ignore correct');
      t.equal(vulnerabilities.length, 1, 'one vuln');
      t.equal(vulnerabilities[0].id, 'npm:marked:20170112', 'vuln correct');
    });
  });

  t.test('custom policy path', function (t) {
    chdirWorkspaces('npm-package-policy');

    var expected = fs.readFileSync(path.join('custom-location', '.snyk'),
      'utf8');
    var vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    return cli.test('.', {
      'policy-path': 'custom-location',
      json: true,
    })
    .then(function (res) {
      var req = server.popRequest();
      var policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');

      var output = JSON.parse(res);
      var ignore = output.filtered.ignore;
      var vulnerabilities = output.vulnerabilities;
      t.equal(ignore.length, 2, 'two ignore rules');
      t.equal(ignore[0].id, 'npm:marked:20170112', 'first ignore correct');
      t.equal(ignore[1].id, 'npm:marked:20170907', 'second ignore correct');
      t.equal(vulnerabilities.length, 0, 'all vulns ignored');
    });
  });


  t.test('api ignores policy', function (t) {
    chdirWorkspaces('npm-package-policy');
    var expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    return snykPolicy.loadFromText(expected)
    .then(function (policy) {
      policy.ignore['npm:marked:20170112'] = [
        {'*': {reasonType: 'wont-fix', source: 'api'}},
      ];

      var vulns = require('./fixtures/npm-package-policy/vulns.json');
      vulns.policy = policy.toString();
      server.setNextResponse(vulns);

      return cli.test('.', {
        json: true,
      })
      .then(function (res) {
        var req = server.popRequest();
        var policyString = req.body.policy;
        t.equal(policyString, expected, 'sends correct policy');

        var output = JSON.parse(res);
        var ignore = output.filtered.ignore;
        var vulnerabilities = output.vulnerabilities;
        t.equal(ignore.length, 2, 'two ignore rules');
        t.equal(vulnerabilities.length, 0, 'no vulns');
      });
    });
  });
});

test('`test npm-package-with-git-url ` handles git url with patch policy', function (t) {
  chdirWorkspaces('npm-package-with-git-url');
  var vulns = require('./fixtures/npm-package-with-git-url/vulns.json');
  server.setNextResponse(vulns);
  return cli.test()
    .catch(res => {
      server.popRequest();

      t.match(res.message, 'for known vulnerabilities', 'found results');

      t.match(res.message,
        'Local Snyk policy: found',
        'found policy file');
    });
});

/**
 * `monitor`
 */

test('`monitor --policy-path`', function (t) {
  t.plan(2);
  chdirWorkspaces('npm-package-policy');

  t.test('default policy', function (t) {
    return cli.monitor('.')
    .then(function (res) {
      var req = server.popRequest();
      var policyString = req.body.policy;
      var expected = fs.readFileSync(path.join('.snyk'), 'utf8');
      t.equal(policyString, expected, 'sends correct policy');
    });
  });

  t.test('custom policy path', function (t) {
    return cli.monitor('.', {
      'policy-path': 'custom-location',
      json: true,
    })
    .then(function (res) {
      var req = server.popRequest();
      var policyString = req.body.policy;
      var expected = fs.readFileSync(path.join('custom-location', '.snyk'),
        'utf8');
      t.equal(policyString, expected, 'sends correct policy');
    });
  });
});

test('`monitor non-existing --json`', function (t) {
  chdirWorkspaces();
  return cli.monitor('non-existing', {json: true})
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    var errObj = JSON.parse(error.message);
    t.notOk(errObj.ok, 'ok object should be false');
    t.match(errObj.error, 'is not a valid path', 'show err message');
    t.match(errObj.path, 'non-existing', 'should show specified path');
    t.pass('throws error');
  });
});

test('`monitor non-existing`', function (t) {
  chdirWorkspaces();
  return cli.monitor('non-existing', {json: false})
  .then(function () {
    t.fail('should have failed');
  })
  .catch(function (error) {
    t.match(error.message, 'is not a valid path', 'show err message');
    t.pass('throws error');
  });
});

test('`monitor npm-package`', function (t) {
  chdirWorkspaces();
  return cli.monitor('npm-package')
  .then(function () {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/npm', 'puts at correct url');
    t.ok(pkg.dependencies['debug'], 'dependency');
    t.notOk(pkg.dependencies['object-assign'],
      'no dev dependency');
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(pkg.dependencies['debug'].from,
      'no "from" array on dep');
  });
});

test('`monitor npm-package with custom --project-name`', function (t) {
  chdirWorkspaces();
  return cli.monitor('npm-package', {
    'project-name': 'custom-project-name',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.body.meta.projectName, 'custom-project-name');
  });
});

test('`monitor npm-package with dev dep flag`', function (t) {
  chdirWorkspaces();
  return cli.monitor('npm-package', { dev: true })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/npm', 'puts at correct url');
    t.ok(req.body.package.dependencies['debug'], 'dependency');
    t.ok(req.body.package.dependencies['object-assign'],
      'includes dev dependency');
  });
});

test('`monitor ruby-app`', function (t) {
  chdirWorkspaces();
  return cli.monitor('ruby-app')
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/rubygems', 'puts at correct url');
    t.equal(req.body.package.targetFile, 'Gemfile', 'specifies target');
    t.match(decode64(req.body.package.files.gemfileLock.contents),
      'remote: http://rubygems.org/', 'attaches Gemfile.lock');
  });
});

test('`monitor maven-app`', function (t) {
  chdirWorkspaces();
  stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
  return cli.monitor('maven-app', {file: 'pom.xml', dev: true})
  .then(function () {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.equal(pkg.name, 'com.mycompany.app:maven-app', 'specifies name');
    t.ok(pkg.dependencies['junit:junit'], 'specifies dependency');
    t.equal(pkg.dependencies['junit:junit'].name,
      'junit:junit',
      'specifies dependency name');
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(pkg.dependencies['junit:junit'].from, 'no "from" array on dep');
  });
});

test('`monitor maven-multi-app`', function (t) {
  chdirWorkspaces();
  stubExec(t, 'maven-multi-app/mvn-dep-tree-stdout.txt');
  return cli.monitor('maven-multi-app', {file: 'pom.xml'})
  .then(function () {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.equal(pkg.name, 'com.mycompany.app:maven-multi-app', 'specifies name');
    t.ok(pkg.dependencies['com.mycompany.app:simple-child'],
      'specifies dependency');
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(pkg.dependencies['com.mycompany.app:simple-child'].from,
      'no "from" array on dep');
  });
});

test('`monitor yarn-app`', function (t) {
  chdirWorkspaces('yarn-app');
  return cli.monitor()
  .then(function () {
    var req = server.popRequest();
    var pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/npm', 'puts at correct url');
    t.equal(pkg.name, 'yarn-app-one', 'specifies name');
    t.ok(pkg.dependencies.marked, 'specifies dependency');
    t.equal(pkg.dependencies.marked.name,
      'marked', 'marked dep name');
    t.equal(pkg.dependencies.marked.version,
      '0.3.6', 'marked dep version');
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(pkg.dependencies.marked.from,
      'no "from" array on dep');
  });
});

test('`monitor pip-app --file=requirements.txt`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {},
        package: {},
      });
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('pip')
  .returns(plugin);

  return cli.monitor('pip-app', {
    file: 'requirements.txt',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/pip', 'puts at correct url');
    t.same(plugin.inspect.getCall(0).args,
      ['pip-app', 'requirements.txt', {
        args: null,
        file: 'requirements.txt',
      }], 'calls python plugin');
  });
});

test('`monitor golang-app --file=Gopkg.lock',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {
          targetFile: 'Gopkg.lock',
        },
        package: {},
      });
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('golangdep')
  .returns(plugin);

  return cli.monitor('golang-app', {
    file: 'Gopkg.lock',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/golangdep', 'puts at correct url');
    t.equal(req.body.targetFile, 'Gopkg.lock', 'sends the targetFile');
    t.same(plugin.inspect.getCall(0).args,
      ['golang-app', 'Gopkg.lock', {
        args: null,
        file: 'Gopkg.lock',
      }], 'calls golang plugin');
  });
});

test('`monitor golang-app --file=vendor/vendor.json`',
function (t) {
  chdirWorkspaces();
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {
          targetFile: 'vendor/vendor.json',
        },
        package: {},
      });
    },
  };
  sinon.spy(plugin, 'inspect');

  sinon.stub(plugins, 'loadPlugin');
  t.teardown(plugins.loadPlugin.restore);
  plugins.loadPlugin
  .withArgs('govendor')
  .returns(plugin);

  return cli.monitor('golang-app', {
    file: 'vendor/vendor.json',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/govendor', 'puts at correct url');
    t.equal(req.body.targetFile, 'vendor/vendor.json', 'sends the targetFile');
    t.same(plugin.inspect.getCall(0).args,
      ['golang-app', 'vendor/vendor.json', {
        args: null,
        file: 'vendor/vendor.json',
      }], 'calls golang plugin');
  });
});

test('`monitor composer-app ruby-app` works on multiple params', function (t) {
  chdirWorkspaces();
  return cli.monitor('composer-app', 'ruby-app', { json: true })
  .then(function (results) {
    results = JSON.parse(results);
    // assert two proper responses
    t.equal(results.length, 2, '2 monitor results');

    // assert results contain monitor urls
    t.match(results[0].manageUrl, 'http://localhost:12345/manage',
      'first monitor url is present');
    t.match(results[1].manageUrl, 'http://localhost:12345/manage',
      'second monitor url is present');

    // assert results contain monitor urls
    t.match(results[0].path, 'composer', 'first monitor url is composer');
    t.match(results[1].path, 'ruby-app', 'second monitor url is ruby-app');

    // assert proper package managers detected
    t.match(results[0].packageManager, 'composer', 'composer package manager');
    t.match(results[1].packageManager, 'rubygems', 'rubygems package manager');
    t.end();
  })
  .catch(function (err) {
    t.fail(err.message);
  });
});

test('`monitor foo:latest --docker`',
function (t) {
  var dockerImageId = 'sha256:' +
    '578c3e61a98cb5720e7c8fc152017be1dff373ebd72a32bbe6e328234efc8d1a';
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {
          packageManager: 'rpm',
          dockerImageId: dockerImageId,
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

  return cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/rpm',
      'puts at correct url (uses package manager from plugin response)');
    t.equal(req.body.meta.dockerImageId, dockerImageId, 'sends dockerImageId');
    t.same(plugin.inspect.getCall(0).args,
      ['foo:latest', null, {
        args: null,
        docker: true,
        org: 'explicit-org',
      }], 'calls docker plugin with expected arguments');
  });
});

test('`monitor foo:latest --docker` doesnt send policy from cwd',
function (t) {
  chdirWorkspaces('npm-package-policy');
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {
          packageManager: 'rpm',
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

  return cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/rpm',
      'puts at correct url (uses package manager from plugin response)');
    t.same(plugin.inspect.getCall(0).args,
      ['foo:latest', null, {
        args: null,
        docker: true,
        org: 'explicit-org',
      }], 'calls docker plugin with expected arguments');

    return snykPolicy.create().then(function (emptyPolicy) {
      t.same(req.body.policy, emptyPolicy.toString(), 'empty policy is sent');
    });
  });
});

test('`monitor foo:latest --docker` with custom policy path',
function (t) {
  chdirWorkspaces('npm-package-policy');
  var plugin = {
    inspect: function () {
      return Promise.resolve({
        plugin: {
          packageManager: 'rpm',
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

  return cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
    'policy-path': 'custom-location',
  })
  .then(function () {
    var req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/rpm',
      'puts at correct url (uses package manager from plugin response)');
    t.same(plugin.inspect.getCall(0).args,
      ['foo:latest', null, {
        args: null,
        docker: true,
        org: 'explicit-org',
        'policy-path': 'custom-location',
      }], 'calls docker plugin with expected arguments');
    var expected = fs.readFileSync(
      path.join('custom-location', '.snyk'),
      'utf8');
    var policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');
  });
});

test('`wizard` for unsupported package managers', function (t) {
  chdirWorkspaces();
  function testUnsupported(data) {
    return cli.wizard({file: data.file})
    .then(function () { throw 'fail'; })
    .catch(function (e) {
      if (e === 'fail') { throw e; }
      return e;
    });
  }
  var cases = [
    { file: 'ruby-app/Gemfile.lock', type: 'RubyGems' },
    { file: 'maven-app/pom.xml', type: 'Maven' },
    { file: 'pip-app/requirements.txt', type: 'Python' },
    { file: 'sbt-app/build.sbt', type: 'SBT' },
    { file: 'gradle-app/build.gradle', type: 'Gradle' },
    { file: 'golang-app/Gopkg.lock', type: 'Golang/Dep' },
    { file: 'golang-app/vendor/vendor.json', type: 'Govendor' },
    { file: 'composer-app/composer.lock', type: 'Composer' },
  ];
  return Promise.all(cases.map(testUnsupported))
  .then(function (results) {
    results.map(function (result, i) {
      var type = cases[i].type;
      t.match(result, 'Snyk wizard for ' + type +
        ' projects is not currently supported', type);
    });
  });
});

test('`protect` for unsupported package managers', function (t) {
  chdirWorkspaces();
  function testUnsupported(data) {
    return cli.protect({file: data.file})
    .then(function () { throw 'fail'; })
    .catch(function (e) {
      if (e === 'fail') { throw e; }
      return e;
    });
  }
  var cases = [
    { file: 'ruby-app/Gemfile.lock', type: 'RubyGems' },
    { file: 'maven-app/pom.xml', type: 'Maven' },
    { file: 'pip-app/requirements.txt', type: 'Python' },
    { file: 'sbt-app/build.sbt', type: 'SBT' },
    { file: 'gradle-app/build.gradle', type: 'Gradle' },
    { file: 'golang-app/Gopkg.lock', type: 'Golang/Dep' },
    { file: 'golang-app/vendor/vendor.json', type: 'Govendor' },
    { file: 'composer-app/composer.lock', type: 'Composer' },
  ];
  return Promise.all(cases.map(testUnsupported))
  .then(function (results) {
    results.map(function (result, i) {
      var type = cases[i].type;
      t.match(result.message, 'Snyk protect for ' + type +
        ' projects is not currently supported', type);
    });
  });
});

test('`protect --policy-path`', function (t) {
  t.plan(2);
  chdirWorkspaces('npm-package-policy');

  t.test('default policy', function (t) {
    var expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    var vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);
    return cli.protect()
    .catch(function (err) {
      var req = server.popRequest();
      var policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');
    });
  });

  t.test('custom policy path', function (t) {
    var expected = fs.readFileSync(path.join('custom-location', '.snyk'),
      'utf8');
    var vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);
    return cli.protect({
      'policy-path': 'custom-location',
    })
    .catch(function (err) {
      var req = server.popRequest();
      var policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');
    });
  });
});

test('`protect` with no policy', function (t) {
  t.plan(1);
  chdirWorkspaces('npm-with-dep-missing-policy');

  var vulns = require('./fixtures/npm-package-policy/vulns.json');
  server.setNextResponse(vulns);

  var projectPolicy = fs.readFileSync(
    __dirname + '/workspaces/npm-with-dep-missing-policy/.snyk').toString();

  return cli.protect()
  .then(function () {
    var req = server.popRequest();
    var policySentToServer = req.body.policy;
    t.equal(policySentToServer, projectPolicy, 'sends correct policy');
  })
  .catch(function (err) {
    t.fail(err);
  });
});

test('`test --insecure`', function (t) {
  t.plan(2);
  chdirWorkspaces('npm-package');

  t.test('default (insecure false)', function (t) {
    sinon.stub(needle, 'request').callsFake(function(a, b, c, d, cb) {
      cb(new Error('bail'));
    });
    t.teardown(needle.request.restore);
    return cli.test('npm-package')
    .catch(function () {
      t.notOk(needle.request.firstCall.args[3].rejectUnauthorized,
        'rejectUnauthorized not present (same as true)');
    });
  });

  t.test('insecure true', function (t) {
    // Unfortunately, all acceptance tests run through cli/commands
    // which bypasses `args`, and `ignoreUnknownCA` is a global set
    // by `args`, so we simply set the global here.
    // NOTE: due to this we add tests to `args.test.js`
    global.ignoreUnknownCA = true;
    sinon.stub(needle, 'request').callsFake(function (a, b, c, d, cb) {
      cb(new Error('bail'));
    });
    t.teardown(function () {
      delete global.ignoreUnknownCA;
      needle.request.restore();
    });
    return cli.test('npm-package')
    .catch(function () {
      t.false(needle.request.firstCall.args[3].rejectUnauthorized,
        'rejectUnauthorized false');
    });
  });
});

/**
 * We can't expect all test environments to have Maven installed
 * So, hijack the system exec call and return the expected output
 */
function stubExec(t, execOutputFile) {
  var stub = sinon.stub(subProcess, 'execute').callsFake(function () {
    var stdout = fs.readFileSync(path.join(execOutputFile), 'utf8');
    return Promise.resolve(stdout);
  });
  t.teardown(function () {
    stub.restore();
  });
}

// @later: try and remove this config stuff
// Was copied straight from ../src/cli-server.js
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
