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

test('`test nuget-app --file=non_existent`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('nuget-app', { file: 'non-existent' });
    t.fail('should have failed');
  } catch (err) {
    t.pass('throws err');
    t.match(
      err.message,
      'Could not find the specified file: non-existent',
      'show first part of err message',
    );
    t.match(
      err.message,
      'Please check that it exists and try again.',
      'show second part of err message',
    );
  }
});

test('`test nuget-app-2 auto-detects project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'project.assets.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app-2');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app-2',
      'project.assets.json',
      {
        args: null,
        file: 'project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app-2',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app-2.1 auto-detects obj/project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'obj/project.assets.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app-2.1');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app-2.1',
      'obj/project.assets.json',
      {
        args: null,
        file: 'obj/project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app-2.1',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app-4 auto-detects packages.config`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app-4');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app-4',
      'packages.config',
      {
        args: null,
        file: 'packages.config',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app-4',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app --file=project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'project.assets.json',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app', {
    file: 'project.assets.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'project.assets.json', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app',
      'project.assets.json',
      {
        args: null,
        file: 'project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app --file=packages.config`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'packages.config',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app', {
    file: 'packages.config',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'packages.config', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app',
      'packages.config',
      {
        args: null,
        file: 'packages.config',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app --file=project.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'project.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app', {
    file: 'project.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'project.json', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app',
      'project.json',
      {
        args: null,
        file: 'project.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test paket-app auto-detects paket.dependencies`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('paket').returns(plugin);

  await cli.test('paket-app');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'paket');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'paket-app',
      'paket.dependencies',
      {
        args: null,
        file: 'paket.dependencies',
        org: null,
        projectName: null,
        packageManager: 'paket',
        path: 'paket-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test paket-obj-app auto-detects obj/project.assets.json if exists`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('paket-obj-app');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'paket-obj-app',
      'obj/project.assets.json',
      {
        args: null,
        file: 'obj/project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'paket-obj-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test paket-app --file=paket.dependencies`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('paket').returns(plugin);

  await cli.test('paket-app', {
    file: 'paket.dependencies',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'paket');
  t.equal(req.body.targetFile, 'paket.dependencies', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'paket-app',
      'paket.dependencies',
      {
        args: null,
        file: 'paket.dependencies',
        org: null,
        projectName: null,
        packageManager: 'paket',
        path: 'paket-app',
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
