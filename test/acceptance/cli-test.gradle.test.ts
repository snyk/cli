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
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';

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

test('`test gradle-kotlin-dsl-app` returns correct meta', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  const res = await cli.test('gradle-kotlin-dsl-app');
  const meta = res.slice(res.indexOf('Organization:')).split('\n');
  t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
  t.match(meta[1], /Package manager:\s+gradle/, 'package manager displayed');
  t.match(meta[2], /Target file:\s+build.gradle.kts/, 'target file displayed');
  t.match(meta[3], /Open source:\s+no/, 'open source displayed');
  t.match(meta[4], /Project path:\s+gradle-kotlin-dsl-app/, 'path displayed');
  t.notMatch(
    meta[5],
    /Local Snyk policy:\s+found/,
    'local policy not displayed',
  );
});

test('`test gradle-app` returns correct meta', async (t) => {
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
  loadPlugin.withArgs('gradle').returns(plugin);

  const res = await cli.test('gradle-app');
  const meta = res.slice(res.indexOf('Organization:')).split('\n');

  t.false(
    ((spyPlugin.args[0] as any)[2] as any).allSubProjects,
    '`allSubProjects` option is not sent',
  );
  t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
  t.match(meta[1], /Package manager:\s+gradle/, 'package manager displayed');
  t.match(meta[2], /Target file:\s+build.gradle/, 'target file displayed');
  t.match(meta[3], /Open source:\s+no/, 'open source displayed');
  t.match(meta[4], /Project path:\s+gradle-app/, 'path displayed');
  t.notMatch(
    meta[5],
    /Local Snyk policy:\s+found/,
    'local policy not displayed',
  );
});

test('`test gradle-app --all-sub-projects` sends `allSubProjects` argument to plugin', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return { plugin: { name: 'gradle' }, package: {} };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  await cli.test('gradle-app', {
    allSubProjects: true,
  });
  t.true(((spyPlugin.args[0] as any)[2] as any).allSubProjects);
});

test('`test gradle-app` plugin fails to return package or scannedProjects', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return { plugin: { name: 'gradle' } };
    },
  };
  sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  try {
    await cli.test('gradle-app', {});
    t.fail('expected error');
  } catch (error) {
    t.match(
      error,
      /error getting dependencies from gradle plugin: neither 'package' nor 'scannedProjects' were found/,
      'error found',
    );
  }
});

test('`test gradle-app --all-sub-projects` returns correct multi tree meta', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect(): Promise<pluginApi.MultiProjectResult> {
      return {
        plugin: { name: 'gradle' },
        scannedProjects: [
          {
            depTree: {
              name: 'tree0',
              version: '1.0.0',
              dependencies: { dep1: { name: 'dep1', version: '1' } },
            },
          },
          {
            depTree: {
              name: 'tree1',
              version: '2.0.0',
              dependencies: { dep1: { name: 'dep2', version: '2' } },
            },
          },
        ],
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  const res = await cli.test('gradle-app', { allSubProjects: true });
  t.true(
    ((spyPlugin.args[0] as any)[2] as any).allSubProjects,
    '`allSubProjects` option is sent',
  );

  const tests = res.split('Testing gradle-app...').filter((s) => !!s.trim());
  t.equals(tests.length, 2, 'two projects tested independently');
  t.match(
    res,
    /Tested 2 projects/,
    'number projects tested displayed properly',
  );
  for (let i = 0; i < tests.length; i++) {
    const meta = tests[i].slice(tests[i].indexOf('Organization:')).split('\n');
    t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
    t.match(meta[1], /Package manager:\s+gradle/, 'package manager displayed');
    t.match(meta[2], /Target file:\s+build.gradle/, 'target file displayed');
    t.match(meta[3], /Project name:\s+tree/, 'sub-project displayed');
    t.includes(meta[3], `tree${i}`, 'sub-project displayed');
    t.match(meta[4], /Open source:\s+no/, 'open source displayed');
    t.match(meta[5], /Project path:\s+gradle-app/, 'path displayed');
    t.notMatch(
      meta[6],
      /Local Snyk policy:\s+found/,
      'local policy not displayed',
    );
  }
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
