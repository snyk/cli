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

test('`test golang-gomodules --file=go.mod`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'go.mod',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gomodules').returns(plugin);

  await cli.test('golang-gomodules', {
    file: 'go.mod',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'gomodules');
  t.equal(req.body.targetFile, 'go.mod', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-gomodules',
      'go.mod',
      {
        args: null,
        file: 'go.mod',
        org: null,
        projectName: null,
        packageManager: 'gomodules',
        path: 'golang-gomodules',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app` auto-detects golang-gomodules', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'go.mod',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gomodules').returns(plugin);

  await cli.test('golang-gomodules');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'gomodules');
  t.equal(req.body.targetFile, 'go.mod', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-gomodules',
      'go.mod',
      {
        args: null,
        file: 'go.mod',
        org: null,
        projectName: null,
        packageManager: 'gomodules',
        path: 'golang-gomodules',
        showVulnPaths: 'some',
      },
    ],
    'calls golang-gomodules plugin',
  );
});

test('`test golang-app --file=Gopkg.lock`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'Gopkg.lock',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('golangdep').returns(plugin);

  await cli.test('golang-app', {
    file: 'Gopkg.lock',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
  t.equal(req.body.targetFile, 'Gopkg.lock', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app',
      'Gopkg.lock',
      {
        args: null,
        file: 'Gopkg.lock',
        org: null,
        projectName: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app --file=vendor/vendor.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'vendor/vendor.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('govendor').returns(plugin);

  await cli.test('golang-app', {
    file: 'vendor/vendor.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'govendor');
  t.equal(req.body.targetFile, 'vendor/vendor.json', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app',
      'vendor/vendor.json',
      {
        args: null,
        file: 'vendor/vendor.json',
        org: null,
        projectName: null,
        packageManager: 'govendor',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app` auto-detects golang/dep', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'Gopkg.lock',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('golangdep').returns(plugin);

  await cli.test('golang-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
  t.equal(req.body.targetFile, 'Gopkg.lock', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app',
      'Gopkg.lock',
      {
        args: null,
        file: 'Gopkg.lock',
        org: null,
        projectName: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app-govendor` auto-detects govendor', async (t) => {
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
  loadPlugin.withArgs('govendor').returns(plugin);

  await cli.test('golang-app-govendor');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'govendor');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app-govendor',
      'vendor/vendor.json',
      {
        args: null,
        file: 'vendor/vendor.json',
        org: null,
        projectName: null,
        packageManager: 'govendor',
        path: 'golang-app-govendor',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
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
