import * as tap from 'tap';
import * as sinon from 'sinon';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as version from '../../src/lib/version';
import * as subProcess from '../../src/lib/sub-process';
import * as path from 'path';
import * as fs from 'fs';

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
import * as depGraphLib from '@snyk/dep-graph';

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

test('`test maven-app --file=pom.xml --dev` sends package info', async (t) => {
  chdirWorkspaces();
  stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
  await cli.test('maven-app', {
    file: 'pom.xml',
    org: 'nobelprize.org',
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
  t.equal(req.query.org, 'nobelprize.org', 'org sent as a query in request');
  t.match(req.body.targetFile, undefined, 'target is undefined');

  const depGraph = depGraphLib.createFromJSON(req.body.depGraph);
  t.equal(depGraph.rootPkg.name, 'com.mycompany.app:maven-app', 'root name');
  const pkgs = depGraph.getPkgs().map((x) => `${x.name}@${x.version}`);
  t.ok(pkgs.indexOf('com.mycompany.app:maven-app@1.0-SNAPSHOT') >= 0);
  t.ok(pkgs.indexOf('axis:axis@1.4') >= 0);
  t.ok(pkgs.indexOf('junit:junit@3.8.2') >= 0);
});

test('`test maven-app-with-jars --file=example.jar` sends package info', async (t) => {
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
  loadPlugin.withArgs('maven').returns(plugin);

  await cli.test('maven-app-with-jars', {
    file: 'example.jar',
  });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.match(req.body.targetFile, undefined, 'target is undefined');

  t.equal(req.body.depGraph.pkgManager.name, 'maven');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'maven-app-with-jars',
      'example.jar',
      {
        args: null,
        file: 'example.jar',
        org: null,
        projectName: null,
        packageManager: 'maven',
        path: 'maven-app-with-jars',
        showVulnPaths: 'some',
      },
    ],
    'calls mvn plugin',
  );
});

test('`test maven-app-with-jars --file=example.war` sends package info', async (t) => {
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
  loadPlugin.withArgs('maven').returns(plugin);

  await cli.test('maven-app-with-jars', {
    file: 'example.war',
  });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.match(req.body.targetFile, undefined, 'target is undefined');

  t.equal(req.body.depGraph.pkgManager.name, 'maven');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'maven-app-with-jars',
      'example.war',
      {
        args: null,
        file: 'example.war',
        org: null,
        projectName: null,
        packageManager: 'maven',
        path: 'maven-app-with-jars',
        showVulnPaths: 'some',
      },
    ],
    'calls mvn plugin',
  );
});

test('`test maven-app-with-jars --all-jars` sends package info', async (t) => {
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
  loadPlugin.withArgs('maven').returns(plugin);

  await cli.test('maven-app-with-jars', {
    'all-jars': true,
  });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.match(req.body.targetFile, undefined, 'target is undefined');

  t.equal(req.body.depGraph.pkgManager.name, 'maven');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'maven-app-with-jars',
      undefined,
      {
        args: null,
        org: null,
        projectName: null,
        packageManager: 'maven',
        path: 'maven-app-with-jars',
        showVulnPaths: 'some',
      },
    ],
    'calls mvn plugin',
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
