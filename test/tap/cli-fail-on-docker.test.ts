import * as tap from 'tap';
import * as cli from '../../src/cli/commands';
import { fakeServer } from '../acceptance/fake-server';
import * as sinon from 'sinon';
import * as snyk from '../../src/lib';
import { getWorkspaceJSON } from '../acceptance/workspace-helper';
import { makeTmpDirectory } from '../utils';

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

const dockerFixableVulnsResult = getWorkspaceJSON(
  'fail-on',
  'docker',
  'fixable',
  'vulns-result.json',
);

const dockerNoFixableVulnsResult = getWorkspaceJSON(
  'fail-on',
  'docker',
  'no-fixable',
  'vulns-result.json',
);

// snyk test stub responses
const dockerFixableVulns = getWorkspaceJSON(
  'fail-on',
  'docker',
  'fixable',
  'vulns.json',
);
const dockerNoFixableVulns = getWorkspaceJSON(
  'fail-on',
  'docker',
  'no-fixable',
  'vulns.json',
);

before('setup', async (t) => {
  process.env.XDG_CONFIG_HOME = await makeTmpDirectory();
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

test('test docker image with no fixable vulns and --fail-on=all', async (t) => {
  // mocking test results here as CI tooling does not have docker installed
  const snykTestStub = sinon.stub(snyk, 'test').returns(dockerNoFixableVulns);
  try {
    server.setNextResponse(dockerNoFixableVulnsResult);
    await cli.test('debian/sqlite3:latest', {
      failOn: 'all',
      docker: true,
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  } finally {
    snykTestStub.restore();
  }
});

test('test docker image with fixable vulns and --fail-on=all', async (t) => {
  // mocking test results here as CI tooling does not have docker installed
  const snykTestStub = sinon.stub(snyk, 'test').returns(dockerFixableVulns);
  try {
    server.setNextResponse(dockerFixableVulnsResult);
    await cli.test('garethr/snyky:alpine', {
      failOn: 'all',
      docker: true,
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
