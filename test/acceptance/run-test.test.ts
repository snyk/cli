import tap from 'tap';
import { only, test } from 'tap';
import { fakeServer } from './fake-server';
import * as cli from '../../src/cli/commands';

const port = (process.env.PORT = process.env.SNYK_PORT = '12345');
const BASE_API = '/api/v1';
process.env.SNYK_API = 'http://localhost:' + port + BASE_API;
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';
const apiKey = '123456789';
let oldkey;
let oldendpoint;
const server = fakeServer(BASE_API, apiKey);

const before = tap.runOnly ? only : test;
const after = tap.runOnly ? only : test;

// Import has to happen after setting SNYK_API
import { runTest } from '../../src/lib/snyk-test/run-test';
import { TestOptions, Options } from '../../src/lib/types';

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

test('runTest annotates results with remediation data when using node_modules', async (t) => {
  const vulns = require('./fixtures/npm-package-with-git-url/test-graph-result.json');
  server.setNextResponse(vulns);

  const result = await runTest(
    'npm',
    'test/acceptance/workspaces/npm-package-with-git-url',
    { packageManager: 'npm' } as Options & TestOptions,
  );
  t.ok(result[0].vulnerabilities[0].parentDepType, 'has parentDepType');
});

test('runTest annotates results with remediation data when traverseNodeModules', async (t) => {
  const vulns = require('./fixtures/npm-package/test-graph-result.json');
  server.setNextResponse(vulns);

  const result = await runTest(
    'npm',
    'test/acceptance/workspaces/npm-package',
    {
      packageManager: 'npm',
      traverseNodeModules: true,
    } as Options & TestOptions,
  );
  t.ok(result[0].vulnerabilities[0].parentDepType, 'has parentDepType');
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
