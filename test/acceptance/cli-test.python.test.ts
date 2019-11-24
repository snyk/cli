import * as tap from 'tap';
import * as sinon from 'sinon';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as version from '../../src/lib/version';
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

function loadJson(filename: string) {
  return JSON.parse(fs.readFileSync(filename, 'utf-8'));
}

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

test('`test pip-app --file=requirements.txt`', async (t) => {
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
  loadPlugin.withArgs('pip').returns(plugin);

  await cli.test('pip-app', {
    file: 'requirements.txt',
  });
  let req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.match(
    req.url,
    'cli-config/feature-flags/pythonPinningAdvice',
    'to correct url',
  );
  req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pip-app',
      'requirements.txt',
      {
        args: null,
        file: 'requirements.txt',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pip-app',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
  );
});

test('`test pipenv-app --file=Pipfile`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        plugin: {
          targetFile: 'Pipfile',
          name: 'snyk-python-plugin',
          runtime: 'Python',
        },
        package: {},
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('pip').returns(plugin);

  await cli.test('pipenv-app', {
    file: 'Pipfile',
  });
  let req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.match(
    req.url,
    'cli-config/feature-flags/pythonPinningAdvice',
    'to correct url',
  );
  req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'Pipfile', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pipenv-app',
      'Pipfile',
      {
        args: null,
        file: 'Pipfile',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pipenv-app',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
  );
});

test('`test pip-app-transitive-vuln --file=requirements.txt (actionableCliRemediation=false)`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return loadJson('./pip-app-transitive-vuln/inspect-result.json');
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('pip').returns(plugin);

  server.setNextResponse(
    loadJson('./pip-app-transitive-vuln/response-without-remediation.json'),
  );
  try {
    await cli.test('pip-app-transitive-vuln', {
      file: 'requirements.txt',
    });
    t.fail('should throw, since there are vulns');
  } catch (e) {
    t.equals(
      e.message,
      fs.readFileSync('pip-app-transitive-vuln/cli-output.txt', 'utf8'),
    );
  }
  let req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.match(
    req.url,
    'cli-config/feature-flags/pythonPinningAdvice',
    'to correct url',
  );
  req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pip-app-transitive-vuln',
      'requirements.txt',
      {
        args: null,
        file: 'requirements.txt',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pip-app-transitive-vuln',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
  );
});

test('`test pip-app-transitive-vuln --file=requirements.txt (actionableCliRemediation=true)`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return loadJson('./pip-app-transitive-vuln/inspect-result.json');
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('pip').returns(plugin);

  server.setNextResponse(
    loadJson('./pip-app-transitive-vuln/response-with-remediation.json'),
  );
  try {
    await cli.test('pip-app-transitive-vuln', {
      file: 'requirements.txt',
    });
    t.fail('should throw, since there are vulns');
  } catch (e) {
    t.equals(
      e.message,
      fs.readFileSync(
        'pip-app-transitive-vuln/cli-output-actionable-remediation.txt',
        'utf8',
      ),
    );
  }
  let req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.match(
    req.url,
    'cli-config/feature-flags/pythonPinningAdvice',
    'to correct url',
  );
  req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pip-app-transitive-vuln',
      'requirements.txt',
      {
        args: null,
        file: 'requirements.txt',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pip-app-transitive-vuln',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
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
