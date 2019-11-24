import * as tap from 'tap';
import * as sinon from 'sinon';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as version from '../../src/lib/version';
import * as fs from 'fs';
import * as path from 'path';

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

test('`test foo:latest --docker`', async (t) => {
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {},
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`test foo:latest --docker vulnerable paths`', async (t) => {
  stubDockerPluginResponse(
    {
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
    },
    t,
  );

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
    t.match(
      msg,
      'Tested 2 dependencies for known vulnerabilities, found 1 vulnerability',
    );
    t.match(msg, 'From: bzip2/libbz2-1.0@1.0.6-8.1');
    t.match(
      msg,
      'From: apt/libapt-pkg5.0@1.6.3ubuntu0.1 > bzip2/libbz2-1.0@1.0.6-8.1',
    );
    t.false(
      msg.includes('vulnerable paths'),
      'docker should not includes number of vulnerable paths',
    );
  }
});

test('`test foo:latest --docker --file=Dockerfile`', async (t) => {
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {
        docker: {
          baseImage: 'ubuntu:14.04',
        },
      },
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    file: 'Dockerfile',
  });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.equal(req.body.docker.baseImage, 'ubuntu:14.04', 'posts docker baseImage');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      'Dockerfile',
      {
        args: null,
        file: 'Dockerfile',
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`test foo:latest --docker --file=Dockerfile remediation advice`', async (t) => {
  stubDockerPluginResponse('./fixtures/docker/plugin-multiple-deps', t);
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
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {},
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
  const policyString = req.body.policy;
  t.false(policyString, 'policy not sent');
});

test('`test foo:latest --docker` supports custom policy', async (t) => {
  chdirWorkspaces();
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {},
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    'policy-path': 'npm-package-policy/custom-location',
  });
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
        'policy-path': 'npm-package-policy/custom-location',
      },
    ],
    'calls docker plugin with expected arguments',
  );

  const expected = fs.readFileSync(
    path.join('npm-package-policy/custom-location', '.snyk'),
    'utf8',
  );
  const policyString = req.body.policy;
  t.equal(policyString, expected, 'sends correct policy');
});

test('`test foo:latest --docker with binaries`', async (t) => {
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {
        docker: {
          binaries: [{ name: 'node', version: '5.10.1' }],
        },
      },
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    req.body.docker.binaries,
    [{ name: 'node', version: '5.10.1' }],
    'posts docker binaries',
  );
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`test foo:latest --docker with binaries vulnerabilities`', async (t) => {
  stubDockerPluginResponse(
    {
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
          'bzr/libbz2-1.0': {
            version: '1.0.6-8.1',
          },
        },
        docker: {
          binaries: {
            Analysis: [{ name: 'node', version: '5.10.1' }],
          },
        },
      },
    },
    t,
  );

  const vulns = require('./fixtures/docker/find-result-binaries.json');
  server.setNextResponse(vulns);

  try {
    await cli.test('foo:latest', {
      docker: true,
      org: 'explicit-org',
    });
    t.fail('should have found vuln');
  } catch (err) {
    const msg = err.message;
    t.match(
      msg,
      'Tested 3 dependencies for known vulnerabilities, found 3 vulnerabilities',
    );
    t.match(msg, 'From: bzip2/libbz2-1.0@1.0.6-8.1');
    t.match(
      msg,
      'From: apt/libapt-pkg5.0@1.6.3ubuntu0.1 > bzip2/libbz2-1.0@1.0.6-8.1',
    );
    t.match(msg, 'Info: http://localhost:12345/vuln/SNYK-UPSTREAM-NODE-72359');
    t.false(
      msg.includes('vulnerable paths'),
      'docker should not includes number of vulnerable paths',
    );
    t.match(msg, 'Detected 2 vulnerabilities for node@5.10.1');
    t.match(msg, 'High severity vulnerability found in node');
    t.match(msg, 'Fixed in: 5.13.1');
    t.match(msg, 'Fixed in: 5.15.1');
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

// fixture can be fixture path or object
function stubDockerPluginResponse(fixture: string | object, t) {
  const plugin = {
    async inspect() {
      return typeof fixture === 'object' ? fixture : require(fixture);
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin
    .withArgs(sinon.match.any, sinon.match({ docker: true }))
    .returns(plugin);
  t.teardown(loadPlugin.restore);

  return spyPlugin;
}
