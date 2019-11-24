import * as tap from 'tap';
import * as sinon from 'sinon';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as version from '../../src/lib/version';

const { test, only } = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)

const port = (process.env.PORT = process.env.SNYK_PORT = '12345');
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';
const apiKey = '123456789';
let oldkey;
let oldendpoint;
let versionNumber;
const server = fakeServer(process.env.SNYK_API, apiKey);
const before = tap.runOnly ? only : test;
const after = tap.runOnly ? only : test;

// Should be after `process.env` setup.
import * as plugins from '../../src/lib/plugins';

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('setup', async (t) => {
  versionNumber = await version();

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

test('`test composer-app --file=composer.lock`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);

  await cli.test('composer-app', {
    file: 'composer.lock',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'composer');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'composer-app',
      'composer.lock',
      {
        args: null,
        file: 'composer.lock',
        org: null,
        projectName: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: 'some',
      },
    ],
    'calls composer plugin',
  );
});

test('`test composer-app` auto-detects composer.lock', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);

  await cli.test('composer-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'composer');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'composer-app',
      'composer.lock',
      {
        args: null,
        file: 'composer.lock',
        org: null,
        projectName: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: 'some',
      },
    ],
    'calls composer plugin',
  );
});

test('`test composer-app --file=composer.lock --dev`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);

  await cli.test('composer-app', {
    file: 'composer.lock',
    dev: true,
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'composer');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'composer-app',
      'composer.lock',
      {
        args: null,
        dev: true,
        file: 'composer.lock',
        org: null,
        projectName: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: 'some',
      },
    ],
    'calls composer plugin',
  );
});

test('`test composer-app golang-app nuget-app` auto-detects all three projects', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);
  loadPlugin.withArgs('golangdep').returns(plugin);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('composer-app', 'golang-app', 'nuget-app', {
    org: 'test-org',
  });
  // assert three API calls made, each with a different url
  const reqs = Array.from({ length: 3 }).map(() => server.popRequest());

  t.same(
    reqs.map((r) => r.method),
    ['POST', 'POST', 'POST'],
    'all post requests',
  );

  t.same(
    reqs.map((r) => r.headers['x-snyk-cli-version']),
    [versionNumber, versionNumber, versionNumber],
    'all send version number',
  );

  t.same(
    reqs.map((r) => r.url),
    [
      '/api/v1/test-dep-graph?org=test-org',
      '/api/v1/test-dep-graph?org=test-org',
      '/api/v1/test-dep-graph?org=test-org',
    ],
    'all urls are present',
  );

  t.same(
    reqs.map((r) => r.body.depGraph.pkgManager.name).sort(),
    ['composer', 'golangdep', 'nuget'],
    'all urls are present',
  );

  // assert three spyPlugin calls, each with a different app
  const calls = spyPlugin.getCalls().sort((call1: any, call2: any) => {
    return call1.args[0] < call2.args[1]
      ? -1
      : call1.args[0] > call2.args[0]
        ? 1
        : 0;
  });
  t.same(
    calls[0].args,
    [
      'composer-app',
      'composer.lock',
      {
        args: null,
        org: 'test-org',
        file: 'composer.lock',
        projectName: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: 'some',
      },
    ],
    'calls composer plugin',
  );
  t.same(
    calls[1].args,
    [
      'golang-app',
      'Gopkg.lock',
      {
        args: null,
        org: 'test-org',
        file: 'Gopkg.lock',
        projectName: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golangdep plugin',
  );
  t.same(
    calls[2].args,
    [
      'nuget-app',
      'project.assets.json',
      {
        args: null,
        org: 'test-org',
        file: 'project.assets.json',
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

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

function chdirWorkspaces(subdir = '') {
  process.chdir(__dirname + '/workspaces' + (subdir ? '/' + subdir : ''));
}
