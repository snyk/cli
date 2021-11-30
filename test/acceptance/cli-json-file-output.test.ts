import tap from 'tap';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import { chdirWorkspaces, getWorkspaceJSON } from './workspace-helper';
import { TestCommandResult } from '../../src/cli/commands/types';

const { test, only } = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)

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

// fake server responses
const noVulnsResult = getWorkspaceJSON(
  'fail-on',
  'no-vulns',
  'vulns-result.json',
);
const noFixableResult = getWorkspaceJSON(
  'fail-on',
  'no-fixable',
  'vulns-result.json',
);

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

test('test with --json returns without error and with JsonTestCommandResult return type when no vulns found', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    const res: TestCommandResult = await cli.test('no-vulns', {
      json: true,
    });
    t.pass('should not throw an exception');
    const resType = res.constructor.name;
    t.equal(resType, 'JsonTestCommandResult');
  } catch (err) {
    t.fail('should not thrown an exception');
  }
});

test('test without --json returns without error and with HumanReadableTestCommandResult return type when no vulns found', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    const res: TestCommandResult = await cli.test('no-vulns', {});
    t.pass('should not throw an exception');
    const resType = res.constructor.name;
    t.equal(resType, 'HumanReadableTestCommandResult');
  } catch (err) {
    t.fail('should not thrown an exception');
  }
});

test('test with --json throws error and error contains json output with vulnerabilities when vulns found', async (t) => {
  try {
    server.setNextResponse(noFixableResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-fixable', {
      json: true,
    });
    t.fail('should throw exception');
  } catch (err) {
    t.pass('expected err to be thrown');
    t.equal(err.code, 'VULNS', 'should throw exception');
    const returnedJson = JSON.parse(err.jsonStringifiedResults);
    t.ok(returnedJson.vulnerabilities.length > 0);
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
