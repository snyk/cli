import * as tap from 'tap';
import * as cli from '../../src/cli/commands';
import { fakeServer } from '../acceptance/fake-server';
import * as sinon from 'sinon';
import * as snyk from '../../src/lib';
import {
  getWorkspaceJSON,
  chdirWorkspaces,
} from '../acceptance/workspace-helper';

const { test, only } = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)

const port =
  process.env.PORT ||
  process.env.SNYK_PORT ||
  (12345 + +process.env.TAP_CHILD_ID!).toString();
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

const pinnableVulnsResult = getWorkspaceJSON(
  'fail-on',
  'pinnable',
  'vulns-result.json',
);

// snyk test stub responses
const pinnableVulns = getWorkspaceJSON('fail-on', 'pinnable', 'vulns.json');

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

before('prime config', async (t) => {
  await cli.config('set', 'api=' + apiKey);
  t.pass('api token set');
  await cli.config('unset', 'endpoint');
  t.pass('endpoint removed');
  t.end();
});

test('test vulnerable project with pinnable and --fail-on=upgradable', async (t) => {
  // mocking test results here as CI tooling does not have python installed
  const snykTestStub = sinon.stub(snyk, 'test').returns(pinnableVulns);
  try {
    server.setNextResponse(pinnableVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('pinnable', {
      failOn: 'upgradable',
    });
    t.fail('expected test to throw exception');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  } finally {
    snykTestStub.restore();
  }
});

test('test vulnerable project with pinnable and --fail-on=upgradable --json', async (t) => {
  // mocking test results here as CI tooling does not have python installed
  const snykTestStub = sinon.stub(snyk, 'test').returns(pinnableVulns);
  try {
    server.setNextResponse(pinnableVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('pinnable', {
      failOn: 'upgradable',
      json: true,
    });
    t.fail('expected test to throw exception');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  } finally {
    snykTestStub.restore();
  }
});

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
