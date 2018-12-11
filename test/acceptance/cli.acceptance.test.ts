import * as tap from 'tap';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as depGraphLib from '@snyk/dep-graph';
import * as _ from 'lodash';
import * as cli from '../../src/cli/commands';
import * as fakeServer from './fake-server';
import * as subProcess from '../../src/lib/sub-process';
import * as plugins from '../../src/lib/plugins';
import * as needle from 'needle';

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as snykPolicy from 'snyk-policy';

const {test, only} = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)


const port = process.env.PORT = process.env.SNYK_PORT = '12345';
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';
const apiKey = '123456789';
let oldkey;
let oldendpoint;
const server:any = fakeServer(process.env.SNYK_API, apiKey);
const before = tap.runOnly ? only : test;
const after = tap.runOnly ? only : test;

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('setup', async (t) => {
  t.plan(3);
  let key = await cli.config('get', 'api');
  oldkey = key;
  t.pass('existing user config captured');

  key = await cli.config('get', 'endpoint');
  oldendpoint = key;
  t.pass('existing user endpoint captured');

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });
  t.pass('started demo server');
  t.end();
});

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('prime config', async (t) => {
  await cli.config('set', 'api=' + apiKey);
  t.pass('api token set');
  await cli.config('unset', 'endpoint');
  t.pass('endpoint removed');
  t.end();
});


test('test cli with multiple params: good and bad', async (t) => {
  t.plan(6);
  try {
    await cli.test('/', 'semver', {registry: 'npm', org: 'EFF', json: true});
    t.fail('expect to err');
  } catch(err) {
    const errObj = JSON.parse(err.message);
    t.ok(errObj.length == 2, 'expecting two results');
    t.notOk(errObj[0].ok, 'first object shouldnt be ok');
    t.ok(errObj[1].ok, 'second object should be ok');
    t.ok(errObj[0].path.length > 0, 'should have path');
    t.ok(errObj[1].path.length > 0, 'should have path');
    t.pass('info on both objects');
  }
  t.end();
});

test('userMessage correctly bubbles with npm', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('npm-package', {org: 'missing-org'});
    t.fail('expect to err');
  } catch(err) {
    t.equal(err.userMessage, 'cli error message', 'got correct err message');
  }
  t.end();
});

test('userMessage correctly bubbles with everything other than npm', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('ruby-app', { org: 'missing-org' });
    t.fail('expect to err');
  } catch(err) {
    t.equal(err.userMessage, 'cli error message', 'got correct err message');
  };
  t.end();
});

/**
 * Remote package `test`
 */

test('`test semver` sends remote NPM request:', async (t) => {
  t.plan(3);
  // We care about the request here, not the response
  await cli.test('semver', {registry: 'npm', org: 'EFF'});
  const req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.match(req.url, '/vuln/npm/semver', 'gets from correct url');
  t.equal(req.query.org, 'EFF', 'org sent as a query in request');
});

test('`test sinatra --registry=rubygems` sends remote Rubygems request:', async (t) => {
  await cli.test('sinatra', {registry: 'rubygems', org: 'ACME'});
  const req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.match(req.url, '/vuln/rubygems/sinatra', 'gets from correct url');
  t.equal(req.query.org, 'ACME', 'org sent as a query in request');
});

/**
 * Local source `test`
 */

test('`test empty --file=Gemfile`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('empty', {file: 'Gemfile'});
    t.fail('should have failed');
  } catch(err) {
    t.pass('throws err');
    t.match(err.message, 'Could not find the specified file: Gemfile',
      'shows err');
  }
});

test('`test --file=fixtures/protect/package.json`', async (t) => {
  const res = await cli.test(
    path.resolve(__dirname, '..'),
    {file: 'fixtures/protect/package.json'}
  );
  t.match(
    res,
    /Tested 1 dependencies for known vulnerabilities/,
    'should succeed in a folder',
  );
});


test('`test /` test for non-existent with path specified', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('/');
    t.fail('should have failed');
  } catch(err) {
    t.pass('throws err');
    t.match(err.message, 'Could not detect supported target files in /.' +
      '\nPlease see our documentation for supported' +
      ' languages and target files: ' +
      'https://support.snyk.io/getting-started/languages-support' +
      ' and make sure you' +
      ' are in the right directory.');
  }
});

test('`test nuget-app --file=non_existent`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('nuget-app', {file: 'non-existent'});
    t.fail('should have failed');
  } catch(err) {
    t.pass('throws err');
    t.match(err.message, 'Could not find the specified file: non-existent',
      'show first part of err message')
    t.match(err.message, 'Please check that it exists and try again.',
      'show second part of err message')
  }
});

test('`test empty --file=readme.md`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('empty', {file: 'readme.md'});
    t.fail('should have failed');
  } catch(err) {
    t.pass('throws err');
    t.match(err.message,
      'Could not detect package manager for file: readme.md',
      'shows err message for when file specified exists, but not supported');
  }
});

test('`test ruby-app-no-lockfile --file=Gemfile`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('ruby-app-no-lockfile', {file: 'Gemfile'});
    t.fail('should have failed');
  } catch(err) {
    t.pass('throws err');
    t.match(err.message, 'Please run `bundle install`', 'shows err');
  }
});

test('`test ruby-app --file=Gemfile.lock`', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-app', {file: 'Gemfile.lock'});

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['ruby-app@', 'json@2.0.2', 'lynx@0.4.0'].sort(),
    'depGraph looks fine');
});

test('`test ruby-app` meta when no vulns',  async (t) => {
  chdirWorkspaces();
  const res = await cli.test('ruby-app');

  const meta = res.slice(res.indexOf('Organisation:')).split('\n');
  t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
  t.match(meta[1], /Package manager:\s+rubygems/,
    'package manager displayed');
  t.match(meta[2], /Target file:\s+Gemfile/, 'target file displayed');
  t.match(meta[3], /Open source:\s+no/, 'open source displayed');
  t.match(meta[4], /Project path:\s+ruby-app/, 'path displayed');
  t.notMatch(meta[5], /Local Snyk policy:\s+found/,
    'local policy not displayed');
});

test('`test ruby-app-thresholds`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result.json'));

  try {
    await cli.test('ruby-app-thresholds');
    t.fail('should have thrown');
  } catch (err) {
    const res = err.message;

    t.match(res,
      'Tested 7 dependencies for known vulnerabilities, found 6 vulnerabilities, 7 vulnerable paths',
      '6 vulns');

    const meta = res.slice(res.indexOf('Organisation:')).split('\n');
    t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
    t.match(meta[1], /Package manager:\s+rubygems/,
      'package manager displayed');
    t.match(meta[2], /Target file:\s+Gemfile/, 'target file displayed');
    t.match(meta[3], /Open source:\s+no/, 'open source displayed');
    t.match(meta[4], /Project path:\s+ruby-app-thresholds/, 'path displayed');
    t.notMatch(meta[5], /Local Snyk policy:\s+found/,
      'local policy not displayed');
  }
});

test('`test ruby-app-thresholds --severity-threshold=low --json`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-low-severity.json'));

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'low',
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'low');

    const res = JSON.parse(err.message);

    const expected =
      require('./workspaces/ruby-app-thresholds/legacy-res-json-low-severity.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok');
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same');
  }
});

test('`test ruby-app-thresholds --severity-threshold=medium`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-medium-severity.json'));

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'medium',
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'medium');

    const res = err.message;

    t.match(res,
      'Tested 7 dependencies for known vulnerabilities, found 5 vulnerabilities, 6 vulnerable paths',
      '5 vulns');
  }
});

test('`test ruby-app-thresholds --severity-threshold=medium --json`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-medium-severity.json'));

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'medium',
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'medium');

    const res = JSON.parse(err.message);

    const expected =
      require('./workspaces/ruby-app-thresholds/legacy-res-json-medium-severity.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok');
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same');
  }
});

test('`test ruby-app-thresholds --severity-threshold=high', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-high-severity.json'));

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'high',
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'high');

    const res = err.message;

    t.match(res,
      'Tested 7 dependencies for known vulnerabilities, found 3 vulnerabilities, 4 vulnerable paths',
      '3 vulns');
  }
});

test('`test ruby-app-thresholds --severity-threshold=high --json`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-high-severity.json'));

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'high',
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'high');

    const res = JSON.parse(err.message);

    const expected =
      require('./workspaces/ruby-app-thresholds/legacy-res-json-high-severity.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok');
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same');
  }
});

test('`test ruby-app-policy`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-policy/test-graph-result.json'));

  try {
    await cli.test('ruby-app-policy', {
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const res = JSON.parse(err.message);

    const expected =
      require('./workspaces/ruby-app-policy/legacy-res-json.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok');
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same');
  }
});

test('`test ruby-app-policy` with cloud ignores', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-policy/test-graph-result-cloud-ignore.json'));

  try {
    await cli.test('ruby-app-policy', {
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const res = JSON.parse(err.message);

    const expected =
      require('./workspaces/ruby-app-policy/legacy-res-json-cloud-ignore.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok');
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same');
  }
});

test('`test ruby-app-no-vulns`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-no-vulns/test-graph-result.json'));

  const outText = await cli.test('ruby-app-no-vulns', {
    json: true,
  });

  const res = JSON.parse(outText);

  const expected =
    require('./workspaces/ruby-app-no-vulns/legacy-res-json.json');

  t.deepEqual(res, expected, '--json output is the same');
});

test('`test ruby-app-no-vulns`', async (t) => {
  chdirWorkspaces();

  const apiResponse = Object.assign(
    {}, require('./workspaces/ruby-app-no-vulns/test-graph-result.json'));
  apiResponse.meta.isPublic = true;
  server.setNextResponse(apiResponse);

  const outText = await cli.test('ruby-app-no-vulns', {
    json: true,
  });

  const res = JSON.parse(outText);

  const expected = Object.assign(
    {},
    require('./workspaces/ruby-app-no-vulns/legacy-res-json.json'),
    {isPrivate: false});

  t.deepEqual(res, expected, '--json output is the same');
});

test('`test gradle-app` returns correct meta', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  const res = await cli.test('gradle-app');
  const meta = res.slice(res.indexOf('Organisation:')).split('\n');
  t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
  t.match(meta[1], /Package manager:\s+gradle/,
    'package manager displayed');
  t.match(meta[2], /Target file:\s+build.gradle/, 'target file displayed');
  t.match(meta[3], /Open source:\s+no/, 'open source displayed');
  t.match(meta[4], /Project path:\s+gradle-app/, 'path displayed');
  t.notMatch(meta[5], /Local Snyk policy:\s+found/,
    'local policy not displayed');
});

test('`test` returns correct meta when target file specified', async (t) => {
  chdirWorkspaces();
  const res = await cli.test('ruby-app', {file: 'Gemfile.lock'});
  const meta = res.slice(res.indexOf('Organisation:')).split('\n');
  t.match(meta[2], /Target file:\s+Gemfile.lock/, 'target file displayed');

});

test('`test npm-package-policy` returns correct meta', async (t) => {
  chdirWorkspaces();
  const res = await cli.test('npm-package-policy');
  const meta = res.slice(res.indexOf('Organisation:')).split('\n');
  t.match(meta[0], /Organisation:\s+test-org/, 'organisation displayed');
  t.match(meta[1], /Package manager:\s+npm/, 'package manager displayed');
  t.match(meta[2], /Target file:\s+package.json/, 'target file displayed');
  t.match(meta[3], /Open source:\s+no/, 'open source displayed');
  t.match(meta[4], /Project path:\s+npm-package-policy/, 'path displayed');
  t.match(meta[5], /Local Snyk policy:\s+found/, 'local policy displayed');
});


test('`test ruby-gem-no-lockfile --file=ruby-gem.gemspec`', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-gem-no-lockfile', {file: 'ruby-gem.gemspec'});
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(depGraph.pkgs.map((p) => p.id),
    ['ruby-gem-no-lockfile@'],
    'no deps as we dont really support gemspecs yet');
});

test('`test ruby-gem --file=ruby-gem.gemspec`', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-gem', {file: 'ruby-gem.gemspec'});

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['ruby-gem@', 'ruby-gem@0.1.0', 'rake@10.5.0'].sort(),
    'depGraph looks fine');
});

test('`test ruby-app` auto-detects Gemfile', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['ruby-app@', 'json@2.0.2', 'lynx@0.4.0'].sort(),
    'depGraph looks fine');
  t.equal(req.body.targetFile, 'Gemfile', 'specifies target');
});

test('`test nuget-app-2 auto-detects project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('nuget')
    .returns(plugin);

  await cli.test('nuget-app-2');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(spyPlugin.getCall(0).args,
    ['nuget-app-2', 'project.assets.json', {
      args: null,
      file: 'project.assets.json',
      org: null,
      packageManager: 'nuget',
      path: 'nuget-app-2',
      showVulnPaths: true,
    }], 'calls nuget plugin');
});

test('`test nuget-app-2.1 auto-detects obj/project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('nuget')
    .returns(plugin);

  await cli.test('nuget-app-2.1');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(spyPlugin.getCall(0).args,
    ['nuget-app-2.1', 'obj/project.assets.json', {
      args: null,
      file: 'obj/project.assets.json',
      org: null,
      packageManager: 'nuget',
      path: 'nuget-app-2.1',
      showVulnPaths: true,
    }], 'calls nuget plugin');
});

test('`test nuget-app-4 auto-detects packages.config`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('nuget')
    .returns(plugin);

  await cli.test('nuget-app-4');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(spyPlugin.getCall(0).args,
    ['nuget-app-4', 'packages.config', {
      args: null,
      file: 'packages.config',
      org: null,
      packageManager: 'nuget',
      path: 'nuget-app-4',
      showVulnPaths: true,
    }], 'calls nuget plugin');
});

test('`test monorepo --file=sub-ruby-app/Gemfile`', async (t) => {
  chdirWorkspaces();
  await cli.test('monorepo', {file: 'sub-ruby-app/Gemfile'});

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['monorepo@', 'json@2.0.2', 'lynx@0.4.0'].sort(),
    'depGraph looks fine');

  t.equal(req.body.targetFile, path.join('sub-ruby-app', 'Gemfile'),
    'specifies target');
});

test('`test maven-app --file=pom.xml --dev` sends package info', async (t) => {
  chdirWorkspaces();
  stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
  await cli.test('maven-app', {file: 'pom.xml', org: 'nobelprize.org', dev: true});

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.query.org, 'nobelprize.org', 'org sent as a query in request');

  const depGraph = depGraphLib.createFromJSON(req.body.depGraph);
  t.equal(depGraph.rootPkg.name, 'com.mycompany.app:maven-app', 'root name');
  const pkgs = depGraph.getPkgs().map((x) => `${x.name}@${x.version}`);
  t.ok(pkgs.indexOf('com.mycompany.app:maven-app@1.0-SNAPSHOT') >= 0);
  t.ok(pkgs.indexOf('axis:axis@1.4') >= 0);
  t.ok(pkgs.indexOf('junit:junit@3.8.2') >= 0);
});

test('`test npm-package` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package');
  const req = server.popRequest();
  const pkg = req.body;
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

test('`test npm-package --file=package-lock.json ` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package', {file: 'package-lock.json'});
  const req = server.popRequest();
  const pkg = req.body;
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

test('`test npm-package --file=package-lock.json --dev` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package', {file: 'package-lock.json', dev: true});
  const req = server.popRequest();
  const pkg = req.body;
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

test('`test npm-package-shrinkwrap --file=package-lock.json ` with npm-shrinkwrap errors', async (t) => {
  t.plan(1);
  chdirWorkspaces();
  try {
    await cli.test('npm-package-shrinkwrap', {file: 'package-lock.json'});
    t.fail('Should fail');
  } catch(e) {
    t.includes(e.message, '--file=package-lock.json', 'Contains enough info about err');
  }
});

test('`test npm-package-with-subfolder --file=package-lock.json ` picks top-level files', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package-with-subfolder', {file: 'package-lock.json'});
  const req = server.popRequest();
  const pkg = req.body;
  t.equal(pkg.name, 'npm-package-top-level', 'correct package is taken');
  t.ok(pkg.dependencies['to-array'], 'dependency');
});

test('`test npm-package-with-subfolder --file=subfolder/package-lock.json ` picks subfolder files', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package-with-subfolder', {file: 'subfolder/package-lock.json'});
  const req = server.popRequest();
  const pkg = req.body;
  t.equal(pkg.name, 'npm-package-subfolder', 'correct package is taken');
  t.ok(pkg.dependencies['to-array'], 'dependency');
});

test('`test npm-package --file=yarn.lock ` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package', {file: 'yarn.lock'});
  const req = server.popRequest();
  const pkg = req.body;
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

test('`test npm-package --file=yarn.lock --dev` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package', {file: 'yarn.lock', dev: true});
  const req = server.popRequest();
  const pkg = req.body;
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

test('`test npm-package-with-subfolder --file=yarn.lock ` picks top-level files', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package-with-subfolder', {file: 'yarn.lock'});
  const req = server.popRequest();
  const pkg = req.body;
  t.equal(pkg.name, 'npm-package-top-level', 'correct package is taken');
  t.ok(pkg.dependencies['to-array'], 'dependency');
});

test('`test npm-package-with-subfolder --file=subfolder/yarn.lock ` picks subfolder files', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package-with-subfolder', {file: 'subfolder/yarn.lock'});
  const req = server.popRequest();
  const pkg = req.body;
  t.equal(pkg.name, 'npm-package-subfolder', 'correct package is taken');
  t.ok(pkg.dependencies['to-array'], 'dependency');
});

test('`test` on a yarn package does work and displays appropriate text', async (t) => {
  chdirWorkspaces('yarn-app');
  await cli.test();
  const req = server.popRequest();
  const pkg = req.body;
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

test('`test pip-app --file=requirements.txt`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('pip')
    .returns(plugin);

  await cli.test('pip-app', {
    file: 'requirements.txt',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(spyPlugin.getCall(0).args,
    ['pip-app', 'requirements.txt', {
      args: null,
      file: 'requirements.txt',
      org: null,
      packageManager: 'pip',
      path: 'pip-app',
      showVulnPaths: true,
    }], 'calls python plugin');
});

test('`test pipenv-app --file=Pipfile`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('pip')
    .returns(plugin);

  await cli.test('pipenv-app', {
    file: 'Pipfile',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(spyPlugin.getCall(0).args,
    ['pipenv-app', 'Pipfile', {
      args: null,
      file: 'Pipfile',
      org: null,
      packageManager: 'pip',
      path: 'pipenv-app',
      showVulnPaths: true,
    }], 'calls python plugin');
});

test('`test nuget-app --file=project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('nuget')
    .returns(plugin);

  await cli.test('nuget-app', {
    file: 'project.assets.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(spyPlugin.getCall(0).args,
    ['nuget-app', 'project.assets.json', {
      args: null,
      file: 'project.assets.json',
      org: null,
      packageManager: 'nuget',
      path: 'nuget-app',
      showVulnPaths: true,
    }], 'calls nuget plugin');
});

test('`test nuget-app --file=packages.config`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('nuget')
    .returns(plugin);

  await cli.test('nuget-app', {
    file: 'packages.config',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(spyPlugin.getCall(0).args,
    ['nuget-app', 'packages.config', {
      args: null,
      file: 'packages.config',
      org: null,
      packageManager: 'nuget',
      path: 'nuget-app',
      showVulnPaths: true,
    }], 'calls nuget plugin');
});

test('`test nuget-app --file=project.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('nuget')
    .returns(plugin);

  await cli.test('nuget-app', {
    file: 'project.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(spyPlugin.getCall(0).args,
    ['nuget-app', 'project.json', {
      args: null,
      file: 'project.json',
      org: null,
      packageManager: 'nuget',
      path: 'nuget-app',
      showVulnPaths: true,
    }], 'calls nuget plugin');
});

test('`test golang-app --file=Gopkg.lock`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('golangdep')
    .returns(plugin);

  await cli.test('golang-app', {
    file: 'Gopkg.lock',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
  t.same(spyPlugin.getCall(0).args,
    ['golang-app', 'Gopkg.lock', {
      args: null,
      file: 'Gopkg.lock',
      org: null,
      packageManager: 'golangdep',
      path: 'golang-app',
      showVulnPaths: true,
    }], 'calls golang plugin');
});

test('`test golang-app --file=vendor/vendor.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('govendor')
    .returns(plugin);

  await cli.test('golang-app', {
    file: 'vendor/vendor.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'govendor');
  t.same(spyPlugin.getCall(0).args,
    ['golang-app', 'vendor/vendor.json', {
      args: null,
      file: 'vendor/vendor.json',
      org: null,
      packageManager: 'govendor',
      path: 'golang-app',
      showVulnPaths: true,
    }], 'calls golang plugin');
});

test('`test golang-app` auto-detects golang/dep', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('golangdep')
    .returns(plugin);

  await cli.test('golang-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
  t.same(spyPlugin.getCall(0).args,
    ['golang-app', 'Gopkg.lock', {
      args: null,
      file: 'Gopkg.lock',
      org: null,
      packageManager: 'golangdep',
      path: 'golang-app',
      showVulnPaths: true,
    }], 'calls golang plugin');
});

test('`test golang-app-govendor` auto-detects govendor', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('govendor')
    .returns(plugin);

  await cli.test('golang-app-govendor');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'govendor');
  t.same(spyPlugin.getCall(0).args,
    ['golang-app-govendor', 'vendor/vendor.json', {
      args: null,
      file: 'vendor/vendor.json',
      org: null,
      packageManager: 'govendor',
      path: 'golang-app-govendor',
      showVulnPaths: true,
    }], 'calls golang plugin');
});

test('`test composer-app --file=composer.lock`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('composer')
    .returns(plugin);

  await cli.test('composer-app', {
    file: 'composer.lock',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'composer');
  t.same(spyPlugin.getCall(0).args,
    ['composer-app', 'composer.lock', {
      args: null,
      file: 'composer.lock',
      org: null,
      packageManager: 'composer',
      path: 'composer-app',
      showVulnPaths: true,
    }], 'calls composer plugin');
});

test('`test composer-app` auto-detects composer.lock', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
    .withArgs('composer')
    .returns(plugin);

  await cli.test('composer-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'composer');
  t.same(spyPlugin.getCall(0).args,
    ['composer-app', 'composer.lock', {
      args: null,
      file: 'composer.lock',
      org: null,
      packageManager: 'composer',
      path: 'composer-app',
      showVulnPaths: true,
    }], 'calls composer plugin');
});

test('`test composer-app golang-app nuget-app` auto-detects all three projects', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {package: {}};
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);
  loadPlugin.withArgs('golangdep').returns(plugin);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('composer-app', 'golang-app', 'nuget-app', {org: 'test-org'});
  // assert three API calls made, each with a different url
  const reqs = Array.from({length: 3})
    .map(() => server.popRequest());

  t.same(reqs.map((r) => r.method),
    ['POST', 'POST', 'POST'], 'all post requests');

  t.same(reqs.map((r) => r.url), [
    '/api/v1/test-dep-graph?org=test-org',
    '/api/v1/test-dep-graph?org=test-org',
    '/api/v1/test-dep-graph?org=test-org',
  ], 'all urls are present');

  t.same(reqs.map((r) => r.body.depGraph.pkgManager.name).sort(),
    ['composer', 'golangdep', 'nuget'],
    'all urls are present');

  // assert three spyPlugin calls, each with a different app
  const calls = spyPlugin.getCalls().sort( (call1, call2) => {
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
    }], 'calls composer plugin');
  t.same(calls[1].args,
    ['golang-app', 'Gopkg.lock', {
      args: null,
      org: 'test-org',
      file: 'Gopkg.lock',
      packageManager: 'golangdep',
      path: 'golang-app',
      showVulnPaths: true,
    }], 'calls golangdep plugin');
  t.same(calls[2].args,
    ['nuget-app', 'project.assets.json', {
      args: null,
      org: 'test-org',
      file: 'project.assets.json',
      packageManager: 'nuget',
      path: 'nuget-app',
      showVulnPaths: true,
    }], 'calls nuget plugin');
});

test('`test foo:latest --docker`', async (t) => {
  const plugin = {
    async inspect() {
      return {
        plugin: {
          packageManager: 'deb',
        },
        package: {},
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(spyPlugin.getCall(0).args,
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

test('`test foo:latest --docker vulnerable paths`', async (t) => {
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'deb',
        },
        package: {
          name: 'docker-image',
          dependencies: {
            'apt/libapt-pkg5.0': {
              version: '1.6.3ubuntu0.1',
              dependencies: {
                'bzip2/libbz2-1.0': {
                  version: '1.0.6-8.1',
                },
              },
            },
            'bzip2/libbz2-1.0': {
              version: '1.0.6-8.1',
            },
          },
        },
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  const vulns = require('./fixtures/docker/find-result.json');
  server.setNextResponse(vulns);

  try {
    await cli.test('foo:latest', {
      docker: true,
      org: 'explicit-org',
    });
    t.fail('should have found vuln');
  } catch (err) {
    const msg = err.message;
    t.match(msg, 'Tested 2 dependencies for known vulnerabilities, found 1 vulnerability');
    t.match(msg, 'From: bzip2/libbz2-1.0@1.0.6-8.1');
    t.match(msg, 'From: apt/libapt-pkg5.0@1.6.3ubuntu0.1 > bzip2/libbz2-1.0@1.0.6-8.1');
    t.false(msg.includes('vulnerable paths'),
      'docker should not includes number of vulnerable paths');
  }
});

test('`test foo:latest --docker --file=Dockerfile`', async (t) => {
  const plugin = {
    inspect: () => {
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
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    file: 'Dockerfile',
  });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.equal(req.body.docker.baseImage, 'ubuntu:14.04',
    'posts docker baseImage');
  t.same(spyPlugin.getCall(0).args,
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

test('`test foo:latest --docker --file=Dockerfile remediation advice`', async (t) => {
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'deb',
        },
        package: {
          name: 'docker-image',
          docker: {
            baseImage: 'ubuntu:14.04',
          },
          dependencies: {
            'apt/libapt-pkg5.0': {
              version: '1.6.3ubuntu0.1',
              dependencies: {
                'bzip2/libbz2-1.0': {
                  version: '1.0.6-8.1',
                },
              },
            },
            'bzip2/libbz2-1.0': {
              version: '1.0.6-8.1',
            },
          },
        },
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  const vulns = require('./fixtures/docker/find-result-remediation.json');
  server.setNextResponse(vulns);

  try {
    await cli.test('foo:latest', {
      docker: true,
      org: 'explicit-org',
      file: 'Dockerfile',
    });
    t.fail('should have found vuln');
  } catch (err) {
    const msg = err.message;
    t.match(msg, 'Base Image');
    t.match(msg, 'Recommendations for base image upgrade');
  }
});

test('`test foo:latest --docker` doesnt collect policy from cwd', async (t) => {
  chdirWorkspaces('npm-package-policy');
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'deb',
        },
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(spyPlugin.getCall(0).args,
    ['foo:latest', null, {
      args: null,
      file: null,
      docker: true,
      org: 'explicit-org',
      packageManager: null,
      path: 'foo:latest',
      showVulnPaths: true,
    }], 'calls docker plugin with expected arguments');
  const policyString = req.body.policy;
  t.false(policyString, 'policy not sent');
});

test('`test foo:latest --docker` supports custom policy', async (t) => {
  chdirWorkspaces();
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'deb',
        },
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    'policy-path': 'npm-package-policy/custom-location',
  });
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(spyPlugin.getCall(0).args,
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

  const expected = fs.readFileSync(
    path.join('npm-package-policy/custom-location', '.snyk'),
    'utf8');
  const policyString = req.body.policy;
  t.equal(policyString, expected, 'sends correct policy');
});

test('`test --policy-path`', async (t) => {
  t.plan(3);

  t.test('default policy', async (t) => {
    chdirWorkspaces('npm-package-policy');
    const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    const vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    try {
      await cli.test('.', {
        json: true,
      });
      t.fail('should have reported vulns');
    } catch(res) {
      const req = server.popRequest();
      const policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');

      const output = JSON.parse(res.message);
      const ignore = output.filtered.ignore;
      const vulnerabilities = output.vulnerabilities;
      t.equal(ignore.length, 1, 'one ignore rule');
      t.equal(ignore[0].id, 'npm:marked:20170907', 'ignore correct');
      t.equal(vulnerabilities.length, 1, 'one vuln');
      t.equal(vulnerabilities[0].id, 'npm:marked:20170112', 'vuln correct');
    }
  });

  t.test('custom policy path', async (t) => {
    chdirWorkspaces('npm-package-policy');

    const expected = fs.readFileSync(path.join('custom-location', '.snyk'),
      'utf8');
    const vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    const res = await cli.test('.', {
      'policy-path': 'custom-location',
      json: true,
    });
    const req = server.popRequest();
    const policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');

    const output = JSON.parse(res);
    const ignore = output.filtered.ignore;
    const vulnerabilities = output.vulnerabilities;
    t.equal(ignore.length, 2, 'two ignore rules');
    t.equal(ignore[0].id, 'npm:marked:20170112', 'first ignore correct');
    t.equal(ignore[1].id, 'npm:marked:20170907', 'second ignore correct');
    t.equal(vulnerabilities.length, 0, 'all vulns ignored');
  });

  t.test('api ignores policy', async (t) => {
    chdirWorkspaces('npm-package-policy');
    const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    const policy = await snykPolicy.loadFromText(expected);
    policy.ignore['npm:marked:20170112'] = [
      {'*': {reasonType: 'wont-fix', source: 'api'}},
    ];

    const vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = policy.toString();
    server.setNextResponse(vulns);

    const res = await cli.test('.', {
      json: true,
    });
    const req = server.popRequest();
    const policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');

    const output = JSON.parse(res);
    const ignore = output.filtered.ignore;
    const vulnerabilities = output.vulnerabilities;
    t.equal(ignore.length, 2, 'two ignore rules');
    t.equal(vulnerabilities.length, 0, 'no vulns');
  });
});

test('`test npm-package-with-git-url ` handles git url with patch policy', async (t) => {
  chdirWorkspaces('npm-package-with-git-url');
  const vulns = require('./fixtures/npm-package-with-git-url/vulns.json');
  server.setNextResponse(vulns);
  try {
    await cli.test();
    t.fail('should fail');
  } catch(res) {
    server.popRequest();

    t.match(res.message, 'for known vulnerabilities', 'found results');

    t.match(res.message,
      'Local Snyk policy: found',
      'found policy file');
  }
});

test('`test sbt-simple-struts`', async (t) => {
  chdirWorkspaces();

  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {},
        package: require('./workspaces/sbt-simple-struts/dep-tree.json'),
      });
    },
  };
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.returns(plugin);

  t.teardown(() => {
    loadPlugin.restore();
  });

  server.setNextResponse(
    require('./workspaces/sbt-simple-struts/test-graph-result.json'));

  try {
    await cli.test('sbt-simple-struts', {json: true});

    t.fail('should have thrown');

  } catch (err) {
    const res = JSON.parse(err.message);

    const expected =
      require('./workspaces/sbt-simple-struts/legacy-res-json.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities', 'packageManager']),
      _.omit(expected, ['vulnerabilities', 'packageManager']),
      'metadata is ok');
    // NOTE: decided to keep this discrepancy
    t.is(res.packageManager, 'sbt',
      'pacakgeManager is sbt, altough it was mavn with the legacy api');
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same');
  }
});


/**
 * `monitor`
 */
test('`monitor --policy-path`', async (t) => {
  t.plan(2);
  chdirWorkspaces('npm-package-policy');

  t.test('default policy', async (t) => {
    const res = await cli.monitor('.');
    const req = server.popRequest();
    const policyString = req.body.policy;
    const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    t.equal(policyString, expected, 'sends correct policy');
  });

  t.test('custom policy path', async (t) => {
    const res = await cli.monitor('.', {
      'policy-path': 'custom-location',
      json: true,
    });
    const req = server.popRequest();
    const policyString = req.body.policy;
    const expected = fs.readFileSync(path.join('custom-location', '.snyk'),
      'utf8');
    t.equal(policyString, expected, 'sends correct policy');
  });
});

test('`monitor non-existing --json`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.monitor('non-existing', {json: true});
    t.fail('should have failed');
  } catch(err) {
    const errObj = JSON.parse(err.message);
    t.notOk(errObj.ok, 'ok object should be false');
    t.match(errObj.error, 'is not a valid path', 'show err message');
    t.match(errObj.path, 'non-existing', 'should show specified path');
    t.pass('throws err');
  }
});

test('`monitor non-existing`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.monitor('non-existing', {json: false});
    t.fail('should have failed');
  } catch(err) {
    t.match(err.message, 'is not a valid path', 'show err message');
    t.pass('throws err');
  }
});

test('monitor for package with no name', async (t) => {
  t.plan(1);
  await cli.monitor({
    file: __dirname + '/../fixtures/package-sans-name/package.json',
  });
  t.pass('succeed');

});

test('monitor for package with no name in lockfile', async (t) => {
  t.plan(1);
  await cli.monitor({
    file: __dirname + '/../fixtures/package-sans-name-lockfile/package-lock.json',
  });
  t.pass('succeed');
});

test('`monitor npm-package`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('npm-package');
  const req = server.popRequest();
  const pkg = req.body.package;
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/npm', 'puts at correct url');
  t.ok(pkg.dependencies['debug'], 'dependency');
  t.notOk(pkg.dependencies['object-assign'],
    'no dev dependency');
  t.notOk(pkg.from, 'no "from" array on root');
  t.notOk(pkg.dependencies['debug'].from,
    'no "from" array on dep');
});

test('`monitor npm-package with custom --project-name`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('npm-package', {
    'project-name': 'custom-project-name',
  });
  const req = server.popRequest();
  t.equal(req.body.meta.projectName, 'custom-project-name');
});

test('`monitor npm-package with dev dep flag`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('npm-package', { dev: true });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/npm', 'puts at correct url');
  t.ok(req.body.package.dependencies['debug'], 'dependency');
  t.ok(req.body.package.dependencies['object-assign'],
    'includes dev dependency');
});

test('`monitor ruby-app`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('ruby-app');
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/rubygems', 'puts at correct url');
  t.equal(req.body.package.targetFile, 'Gemfile', 'specifies target');
  t.match(decode64(req.body.package.files.gemfileLock.contents),
    'remote: http://rubygems.org/', 'attaches Gemfile.lock');
});

test('`monitor maven-app`', async (t) => {
  chdirWorkspaces();
  stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
  await cli.monitor('maven-app', {file: 'pom.xml', dev: true});
  const req = server.popRequest();
  const pkg = req.body.package;
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

test('`monitor maven-multi-app`', async (t) => {
  chdirWorkspaces();
  stubExec(t, 'maven-multi-app/mvn-dep-tree-stdout.txt');
  await cli.monitor('maven-multi-app', {file: 'pom.xml'});
  const req = server.popRequest();
  const pkg = req.body.package;
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/maven', 'puts at correct url');
  t.equal(pkg.name, 'com.mycompany.app:maven-multi-app', 'specifies name');
  t.ok(pkg.dependencies['com.mycompany.app:simple-child'],
    'specifies dependency');
  t.notOk(pkg.from, 'no "from" array on root');
  t.notOk(pkg.dependencies['com.mycompany.app:simple-child'].from,
    'no "from" array on dep');
});

test('`monitor yarn-app`', async (t) => {
  chdirWorkspaces('yarn-app');
  await cli.monitor();
  const req = server.popRequest();
  const pkg = req.body.package;
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

test('`monitor pip-app --file=requirements.txt`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {},
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('pip').returns(plugin);

  await cli.monitor('pip-app', {
    file: 'requirements.txt',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/pip', 'puts at correct url');
  t.same(spyPlugin.getCall(0).args,
    ['pip-app', 'requirements.txt', {
      args: null,
      file: 'requirements.txt',
    }], 'calls python plugin');
});

test('`monitor golang-app --file=Gopkg.lock', async (t) => {
  chdirWorkspaces();
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          targetFile: 'Gopkg.lock',
        },
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('golangdep').returns(plugin);

  await cli.monitor('golang-app', {
    file: 'Gopkg.lock',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/golangdep', 'puts at correct url');
  t.equal(req.body.targetFile, 'Gopkg.lock', 'sends the targetFile');
  t.same(spyPlugin.getCall(0).args,
    ['golang-app', 'Gopkg.lock', {
      args: null,
      file: 'Gopkg.lock',
    }], 'calls golang plugin');
});

test('`monitor golang-app --file=vendor/vendor.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          targetFile: 'vendor/vendor.json',
        },
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin
  .withArgs('govendor')
  .returns(plugin);

  await cli.monitor('golang-app', {
    file: 'vendor/vendor.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/govendor', 'puts at correct url');
  t.equal(req.body.targetFile, 'vendor/vendor.json', 'sends the targetFile');
  t.same(spyPlugin.getCall(0).args,
    ['golang-app', 'vendor/vendor.json', {
      args: null,
      file: 'vendor/vendor.json',
    }], 'calls golang plugin');
});

test('`monitor composer-app ruby-app` works on multiple params', async (t) => {
  chdirWorkspaces();
  let results = await cli.monitor('composer-app', 'ruby-app', { json: true });
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
});

test('`monitor foo:latest --docker`', async (t) => {
  const dockerImageId = 'sha256:' +
    '578c3e61a98cb5720e7c8fc152017be1dff373ebd72a32bbe6e328234efc8d1a';
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'rpm',
          dockerImageId: dockerImageId,
        },
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)');
  t.equal(req.body.meta.dockerImageId, dockerImageId, 'sends dockerImageId');
  t.same(spyPlugin.getCall(0).args,
    ['foo:latest', null, {
      args: null,
      docker: true,
      org: 'explicit-org',
    }], 'calls docker plugin with expected arguments');
});

test('`monitor foo:latest --docker --file=Dockerfile`', async (t) => {
  const dockerImageId = 'sha256:' +
    '578c3e61a98cb5720e7c8fc152017be1dff373ebd72a32bbe6e328234efc8d1a';
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'rpm',
          dockerImageId: dockerImageId,
        },
        package: {docker: 'base-image-name'},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
    file: 'Dockerfile',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)');
  t.equal(req.body.meta.dockerImageId, dockerImageId, 'sends dockerImageId');
  t.equal(req.body.package.docker, 'base-image-name', 'sends base image');
  t.same(spyPlugin.getCall(0).args,
    ['foo:latest', 'Dockerfile', {
      args: null,
      docker: true,
      file: 'Dockerfile',
      org: 'explicit-org',
    }], 'calls docker plugin with expected arguments');
});

test('`monitor foo:latest --docker` doesnt send policy from cwd', async (t) => {
  chdirWorkspaces('npm-package-policy');
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'rpm',
        },
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)');
  t.same(spyPlugin.getCall(0).args,
    ['foo:latest', null, {
      args: null,
      docker: true,
      org: 'explicit-org',
    }], 'calls docker plugin with expected arguments');

  const emptyPolicy = await snykPolicy.create();
  t.same(req.body.policy, emptyPolicy.toString(), 'empty policy is sent');
});

test('`monitor foo:latest --docker` with custom policy path', async (t) => {
  chdirWorkspaces('npm-package-policy');
  const plugin = {
    inspect: () => {
      return Promise.resolve({
        plugin: {
          packageManager: 'rpm',
        },
        package: {},
      });
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.withArgs(sinon.match.any, sinon.match({docker: true})).returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
    'policy-path': 'custom-location',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)');
  t.same(spyPlugin.getCall(0).args,
    ['foo:latest', null, {
      args: null,
      docker: true,
      org: 'explicit-org',
      'policy-path': 'custom-location',
    }], 'calls docker plugin with expected arguments');
  const expected = fs.readFileSync(
    path.join('custom-location', '.snyk'),
    'utf8');
  const policyString = req.body.policy;
  t.equal(policyString, expected, 'sends correct policy');
});

test('`wizard` for unsupported package managers', async (t) => {
  chdirWorkspaces();
  async function testUnsupported(data) {
    try {
      await cli.wizard({file: data.file});
      t.fail('should fail');
    } catch(e) {
      return e;
    }
  }
  const cases = [
    { file: 'ruby-app/Gemfile.lock', type: 'RubyGems' },
    { file: 'maven-app/pom.xml', type: 'Maven' },
    { file: 'pip-app/requirements.txt', type: 'Python' },
    { file: 'sbt-app/build.sbt', type: 'SBT' },
    { file: 'gradle-app/build.gradle', type: 'Gradle' },
    { file: 'golang-app/Gopkg.lock', type: 'Golang/Dep' },
    { file: 'golang-app/vendor/vendor.json', type: 'Govendor' },
    { file: 'composer-app/composer.lock', type: 'Composer' },
  ];
  const results = await Promise.all(cases.map(testUnsupported));
  results.map((result, i) => {
    const type = cases[i].type;
    t.match(result, 'Snyk wizard for ' + type +
      ' projects is not currently supported', type);
  });
});

test('`protect` for unsupported package managers', async (t) => {
  chdirWorkspaces();
  async function testUnsupported(data) {
    try {
      await cli.protect({file: data.file});
      t.fail('should fail');
    } catch(e) {
      return e;
    }
  }
  const cases = [
    { file: 'ruby-app/Gemfile.lock', type: 'RubyGems' },
    { file: 'maven-app/pom.xml', type: 'Maven' },
    { file: 'pip-app/requirements.txt', type: 'Python' },
    { file: 'sbt-app/build.sbt', type: 'SBT' },
    { file: 'gradle-app/build.gradle', type: 'Gradle' },
    { file: 'golang-app/Gopkg.lock', type: 'Golang/Dep' },
    { file: 'golang-app/vendor/vendor.json', type: 'Govendor' },
    { file: 'composer-app/composer.lock', type: 'Composer' },
  ];
  const results = await Promise.all(cases.map(testUnsupported));
  results.map((result, i) => {
    const type = cases[i].type;
    t.match(result.message, 'Snyk protect for ' + type +
      ' projects is not currently supported', type);
  });
});

test('`protect --policy-path`', async (t) => {
  t.plan(2);
  chdirWorkspaces('npm-package-policy');

  t.test('default policy', async (t) => {
    const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    const vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);
    try {
      await cli.protect();
      t.fail('should fail');
    } catch(err) {
      const req = server.popRequest();
      const policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');
    }
  });

  t.test('custom policy path', async (t) => {
    const expected = fs.readFileSync(path.join('custom-location', '.snyk'),
      'utf8');
    const vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    await cli.protect({
      'policy-path': 'custom-location',
    });
    const req = server.popRequest();
    const policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');
  });
});

test('`protect` with no policy', async (t) => {
  t.plan(1);
  chdirWorkspaces('npm-with-dep-missing-policy');

  const vulns = require('./fixtures/npm-package-policy/vulns.json');
  server.setNextResponse(vulns);

  const projectPolicy = fs.readFileSync(
    __dirname + '/workspaces/npm-with-dep-missing-policy/.snyk').toString();

  await cli.protect();
  const req = server.popRequest();
  const policySentToServer = req.body.policy;
  t.equal(policySentToServer, projectPolicy, 'sends correct policy');
  t.end();
 });

test('`test --insecure`', async (t) => {
  t.plan(2);
  chdirWorkspaces('npm-package');

  t.test('default (insecure false)', async (t) => {
    const requestStub = sinon.stub(needle, 'request').callsFake((a, b, c, d, cb) => {
      cb(new Error('bail'));
    });
    t.teardown(requestStub.restore);
    try {
      await cli.test('npm-package');
      t.fail('should fail');
    } catch(e) {
      t.notOk(requestStub.firstCall.args[3].rejectUnauthorized,
        'rejectUnauthorized not present (same as true)');
    }
  });

  t.test('insecure true', async (t) => {
    // Unfortunately, all acceptance tests run through cli/commands
    // which bypasses `args`, and `ignoreUnknownCA` is a global set
    // by `args`, so we simply set the global here.
    // NOTE: due to this we add tests to `args.test.js`
      (global as any).ignoreUnknownCA = true;
    const requestStub = sinon.stub(needle, 'request').callsFake((a, b, c, d, cb) => {
      cb(new Error('bail'));
    });
    t.teardown(() => {
      delete (global as any).ignoreUnknownCA;
      requestStub.restore();
    });
    try {
      await cli.test('npm-package');
      t.fail('should fail');
    } catch(e)  {
      t.false(requestStub.firstCall.args[3].rejectUnauthorized,
        'rejectUnauthorized false');
    }
  });
});

/**
 * We can't expect all test environments to have Maven installed
 * So, hijack the system exec call and return the expected output
 */
function stubExec(t, execOutputFile) {
  const stub = sinon.stub(subProcess, 'execute').callsFake(() => {
    const stdout = fs.readFileSync(path.join(execOutputFile), 'utf8');
    return Promise.resolve(stdout);
  });
  t.teardown(() => {
    stub.restore();
  });
}

// @later: try and remove this config stuff
// Was copied straight from ../src/cli-server.js
after('teardown', async (t) => {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  await new Promise((resolve) => {
    server.close(resolve);
  });
  t.pass('server shutdown');
  let key = 'set';
  let value = 'api=' + oldkey;
  if (!oldkey) {
    key = 'unset';
    value = 'api';
  }
  await cli.config(key, value);
  t.pass('user config restored');
  if (oldendpoint) {
    await cli.config('endpoint', oldendpoint);
    t.pass('user endpoint restored');
    t.end();
  } else {
    t.pass('no endpoint');
    t.end();
  }
});

function chdirWorkspaces(subdir: string = '') {
  process.chdir(__dirname + '/workspaces' + (subdir ? '/' + subdir : ''));
}

function decode64(str) {
  return new Buffer(str, 'base64').toString('utf8');
}
