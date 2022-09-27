import { test } from 'tap';
import * as ciChecker from '../../src/lib/is-ci';
import * as sinon from 'sinon';
import { fakeServer } from '../acceptance/fake-server';
import { makeTmpDirectory } from '../utils';

const port =
  process.env.PORT ||
  process.env.SNYK_PORT ||
  (12345 + +process.env.TAP_CHILD_ID!).toString();

const apiKey = '123456789';
let oldkey;
let oldendpoint;
const BASE_API = '/api/v1';
process.env.SNYK_API = 'http://localhost:' + port + BASE_API;
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';

const server = fakeServer(BASE_API, apiKey);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as cli from '../../src/cli/commands';
import { CommandResult } from '../../src/cli/commands/types';

const before = test;
const after = test;

before('setup', async (t) => {
  process.env.XDG_CONFIG_HOME = await makeTmpDirectory();
  let key = await cli.config('get', 'api');
  oldkey = key; // just in case
  t.pass('existing user config captured');

  key = await cli.config('get', 'endpoint');
  oldendpoint = key; // just in case
  t.pass('existing user endpoint captured');

  await new Promise<void>((resolve) => server.listen(port, resolve));
  t.pass('started demo server');
});

before('prime config', async (t) => {
  try {
    await cli.config('set', 'api=' + apiKey);
    t.pass('api token set');
    await cli.config('unset', 'endpoint');
    t.pass('endpoint removed');
  } catch (e) {
    t.bailout();
    t.end();
  }
});

test('cli tests for online repos', async (t) => {
  try {
    const res = await cli.test('semver@2');
    t.fail(res);
  } catch (error) {
    const res = error.message;
    const pos = res.toLowerCase().indexOf('vulnerability found');
    t.pass(res);
    t.notEqual(pos, -1, 'correctly found vulnerability: ' + res);
  }

  try {
    const res = await cli.test('semver@2', { json: true });
    t.fail(res);
  } catch (error) {
    const res = JSON.parse(error.message);
    const vuln = res.vulnerabilities[0];
    t.pass(vuln.title);
    t.equal(
      vuln.id,
      'npm:semver:20150403',
      'correctly found vulnerability: ' + vuln.id,
    );
  }
});

test('multiple test arguments', async (t) => {
  try {
    const commandResult: CommandResult = await cli.test('semver@4', 'qs@6');
    const res = commandResult.getDisplayResults();
    const lastLine = res
      .trim()
      .split('\n')
      .pop();
    t.equals(
      lastLine,
      'Tested 2 projects, no vulnerable paths were found.',
      'successfully tested semver@4, qs@6',
    );
  } catch (error) {
    t.fail(error);
  }

  try {
    const res = await cli.test('semver@4', 'qs@1');
    t.fail(res);
  } catch (error) {
    const res = error.message;
    const lastLine = res
      .trim()
      .split('\n')
      .pop();
    t.equals(
      lastLine,
      'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@4, qs@1',
    );
  }

  try {
    const res = await cli.test('semver@2', 'qs@6');
    t.fail(res);
  } catch (error) {
    const res = error.message;
    const lastLine = res
      .trim()
      .split('\n')
      .pop();
    t.equals(
      lastLine,
      'Tested 2 projects, 1 contained vulnerable paths.',
      'successfully tested semver@2, qs@6',
    );
  }

  try {
    const res = await cli.test('semver@2', 'qs@1');
    t.fail(res);
  } catch (error) {
    const res = error.message;
    const lastLine = res
      .trim()
      .split('\n')
      .pop();
    t.equals(
      lastLine,
      'Tested 2 projects, 2 contained vulnerable paths.',
      'successfully tested semver@2, qs@1',
    );
  }
});

test('test for existing remote package with dev-deps only with --dev', async (t) => {
  try {
    const commandResult: CommandResult = await cli.test('lodash@4.17.11', {
      dev: true,
    });
    const res = commandResult.getDisplayResults();
    const lastLine = res
      .trim()
      .split('\n')
      .pop();
    t.deepEqual(
      lastLine,
      '✔ Tested lodash@4.17.11 for known vulnerabilities, no vulnerable paths found.',
      'successfully tested lodash@4.17.11',
    );
  } catch (error) {
    t.fail('should not throw, instead received error: ' + error);
  }
});

test('test for existing remote package with dev-deps only', async (t) => {
  try {
    const ciCheckerStub = sinon.stub(ciChecker, 'isCI');
    ciCheckerStub.returns(false);
    t.teardown(ciCheckerStub.restore);

    const commandResult: CommandResult = await cli.test('lodash@4.17.11', {
      dev: false,
    });
    const res = commandResult.getDisplayResults();
    const lastLine = res
      .trim()
      .split('\n')
      .pop();

    t.deepEqual(
      lastLine,
      'Tip: Snyk only tests production dependencies by default. You can try re-running with the `--dev` flag.',
      'tip text as expected',
    );
  } catch (error) {
    t.fail('should not throw, instead received error: ' + error);
  }
});

test('test for non-existing', async (t) => {
  try {
    server.setNextStatusCode(500);
    const res = await cli.test('@123');
    t.fail('should fail, instead received ' + res);
  } catch (error) {
    const res = error.message;
    const lastLine = res
      .trim()
      .split('\n')
      .pop();
    t.deepEqual(
      lastLine,
      'Internal server error',
      'expected error: Internal server error',
    );
  }
});

after('teardown', async (t) => {
  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  await new Promise<void>((resolve) => {
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
    cli.config('endpoint', oldendpoint).then(() => {
      t.pass('user endpoint restored');
      t.end();
    });
  } else {
    t.pass('no endpoint');
    t.end();
  }
});
