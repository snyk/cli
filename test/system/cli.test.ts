import * as util from 'util';
import * as get from 'lodash.get';
import * as isObject from 'lodash.isobject';
import { test } from 'tap';
import * as ciChecker from '../../src/lib/is-ci';
import * as dockerChecker from '../../src/lib/is-docker';
import { makeTmpDirectory, silenceLog } from '../utils';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as policy from 'snyk-policy';
import stripAnsi from 'strip-ansi';
import * as os from 'os';
import * as isDocker from '../../src/lib/is-docker';

type Ignore = {
  [path: string]: {
    reason: string;
    expires: Date;
    created?: Date;
  };
};

type Policy = {
  [id: string]: Ignore[];
};

const port = process.env.PORT || process.env.SNYK_PORT || '12345';

const apiKey = '123456789';
const notAuthorizedApiKey = 'notAuthorized';
let oldKey;
let oldEndPoint;
const BASE_API = '/api/v1';
process.env.SNYK_API = 'http://localhost:' + port + BASE_API;
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';

const server = require('../cli-server')(BASE_API, apiKey, notAuthorizedApiKey);

sinon.stub(util, 'promisify').returns(() => {});

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as cli from '../../src/cli/commands';
import { PolicyNotFoundError } from '../../src/lib/errors';
import { chdirWorkspaces } from '../acceptance/workspace-helper';

const before = test;
const after = test;

before('setup', async (t) => {
  const key = await cli.config('get', 'api');
  oldKey = key; // just in case
  t.pass('existing user config captured');

  const endPointKey = await cli.config('get', 'endpoint');
  oldEndPoint = endPointKey; // just in case
  t.pass('existing user endpoint captured');

  server.listen(port);
});

before('prime config', async (t) => {
  await cli.config('set', 'api=' + apiKey);
  t.pass('api token set');
  await cli.config('unset', 'endpoint');
  t.pass('endpoint removed');
});

test('test without authentication', async (t) => {
  await cli.config('unset', 'api');
  try {
    await cli.test('semver@2');
    t.fail('test should not pass if not authenticated');
  } catch (error) {
    t.deepEquals(error.strCode, 'NO_API_TOKEN', 'string code is as expected');
    t.match(
      error.message,
      '`snyk` requires an authenticated account. Please run `snyk auth` and try again.',
      'error message is shown as expected',
    );
  }
  await cli.config('set', 'api=' + apiKey);
});

test('auth via key', async (t) => {
  try {
    const res = await cli.auth(apiKey);
    t.notEqual(res.toLowerCase().indexOf('ready'), -1, 'snyk auth worked');
  } catch (e) {
    t.threw(e);
  }
});

test('auth via invalid key', async (t) => {
  const errors = require('../../src/lib/errors/legacy-errors');

  try {
    const res = await cli.auth('_____________');
    t.fail('auth should not succeed: ' + res);
  } catch (e) {
    const message = stripAnsi(errors.message(e));
    t.equal(
      message.toLowerCase().indexOf('authentication failed'),
      0,
      'captured failed auth',
    );
  }
});

test('auth with no args', async (t) => {
  // stub open so browser window doesn't actually open
  const open = sinon.stub();
  const auth = proxyquire('../../src/cli/commands/auth', { open });
  // stub CI check (ensure returns false for system test)
  const ciStub = sinon.stub(ciChecker, 'isCI').returns(false);
  // ensure this works on circleCI as when running outside of a container
  const dockerStub = sinon.stub(dockerChecker, 'isDocker').returns(false);
  // disable console.log
  const enableLog = silenceLog();
  try {
    const res = await auth();
    t.match(
      res,
      'Your account has been authenticated. Snyk is now ready to be used',
      'snyk auth worked',
    );
    t.ok(open.calledOnce, 'called open once');
    t.match(
      open.firstCall.args[0],
      'http://localhost:12345/login?token=',
      'opens login with token param',
    );
    ciStub.restore();
    dockerStub.restore();
  } catch (e) {
    t.threw(e);
  }
  // turn console.log back on
  enableLog();
});

test('auth with UTMs in environment variables', async (t) => {
  // stub open so browser window doesn't actually open
  const open = sinon.stub();
  const auth = proxyquire('../../src/cli/commands/auth', { open });
  // stub CI check (ensure returns false for system test)
  const ciStub = sinon.stub(ciChecker, 'isCI').returns(false);
  // ensure this works on circleCI as when running outside of a container
  const dockerStub = sinon.stub(dockerChecker, 'isDocker').returns(false);

  // read data from console.log
  let stdoutMessages = '';
  const stubConsoleLog = (msg: string) => (stdoutMessages += msg);
  const origConsoleLog = console.log;
  console.log = stubConsoleLog;

  process.env.SNYK_UTM_MEDIUM = 'ide';
  process.env.SNYK_UTM_SOURCE = 'eclipse';
  process.env.SNYK_UTM_CAMPAIGN = 'plugin';

  try {
    await auth();
    t.match(
      stdoutMessages,
      'utm_medium=ide&utm_source=eclipse&utm_campaign=plugin',
      'utm detected in environment variables',
    );
    t.ok(open.calledOnce, 'called open once');
    t.match(
      open.firstCall.args[0],
      '&utm_medium=ide&utm_source=eclipse&utm_campaign=plugin',
      'opens login with utm tokens provided',
    );

    // clean up environment variables
    delete process.env.SNYK_UTM_MEDIUM;
    delete process.env.SNYK_UTM_SOURCE;
    delete process.env.SNYK_UTM_CAMPAIGN;
    // clean up stubs
    ciStub.restore();
    dockerStub.restore();

    // restore original console.log
    console.log = origConsoleLog;
  } catch (e) {
    t.threw(e);
  }
});

test('auth with default UTMs', async (t) => {
  // stub open so browser window doesn't actually open
  const open = sinon.stub();
  const auth = proxyquire('../../src/cli/commands/auth', { open });
  // stub CI check (ensure returns false for system test)
  const ciStub = sinon.stub(ciChecker, 'isCI').returns(false);
  const osStub = sinon.stub(os, 'type').returns('Darwin');
  const isDockerStub = sinon.stub(isDocker, 'isDocker').returns(false);
  // read data from console.log
  let stdoutMessages = '';
  const stubConsoleLog = (msg: string) => (stdoutMessages += msg);
  const origConsoleLog = console.log;
  console.log = stubConsoleLog;

  try {
    await auth();
    t.match(
      stdoutMessages,
      'utm_medium=cli&utm_source=cli&utm_campaign=cli',
      'utm detected in environment variables',
    );
    t.ok(open.calledOnce, 'called open once');
    t.match(
      open.firstCall.args[0],
      '&utm_medium=cli&utm_source=cli&utm_campaign=cli&os=darwin&docker=false',
      'defualt utms are exists',
    );

    // clean up stubs
    ciStub.restore();
    osStub.restore();
    isDockerStub.restore();
    // restore original console.log
    console.log = origConsoleLog;
  } catch (e) {
    t.threw(e);
  }
});
test('cli tests error paths', async (t) => {
  try {
    await cli.test('/', { json: true });
    t.fail('expected exception to be thrown');
  } catch (error) {
    const errObj = JSON.parse(error.message);
    t.ok(errObj.error.length > 1, 'should display error message');
    t.match(errObj.path, '/', 'path property should be populated');
    t.pass('error json with correct output when one bad project specified');
  }
});

test('snyk ignore - all options', async (t) => {
  const clock = sinon.useFakeTimers(new Date(2016, 11, 1).getTime());
  const fullPolicy: Policy = {
    ID: [
      {
        '*': {
          reason: 'REASON',
          expires: new Date('2017-10-07T00:00:00.000Z'),
        },
      },
    ],
  };
  try {
    fullPolicy.ID[0]['*'].created = new Date();
    const dir = await makeTmpDirectory();
    await cli.ignore({
      id: 'ID',
      reason: 'REASON',
      expiry: new Date('2017-10-07'),
      'policy-path': dir,
    });
    const pol = await policy.load(dir);
    t.deepEquals(pol.ignore, fullPolicy, 'policy written correctly');
    clock.restore();
  } catch (err) {
    t.throws(err, 'ignore should succeed');
  }
});

test('snyk ignore - no ID', async (t) => {
  try {
    const dir = await makeTmpDirectory();
    await cli.ignore({
      reason: 'REASON',
      expiry: new Date('2017-10-07'),
      'policy-path': dir,
    });
    t.fail('should not succeed with missing ID');
  } catch (e) {
    const errors = require('../../src/lib/errors/legacy-errors');
    const message = stripAnsi(errors.message(e));
    t.equal(
      message.toLowerCase().indexOf('id is a required field'),
      0,
      'captured failed ignore (no --id given)',
    );
  }
});

test('snyk ignore - default options', async (t) => {
  const clock = sinon.useFakeTimers(new Date(2016, 11, 1).getTime());
  try {
    const dir = await makeTmpDirectory();
    await cli.ignore({
      id: 'ID3',
      'policy-path': dir,
    });
    const pol = await policy.load(dir);
    t.true(pol.ignore.ID3, 'policy ID written correctly');
    t.is(
      pol.ignore.ID3[0]['*'].reason,
      'None Given',
      'policy (default) reason written correctly',
    );
    const expiryFromNow = pol.ignore.ID3[0]['*'].expires - Date.now();
    // not more than 30 days ahead, not less than (30 days - 1 minute)
    t.true(
      expiryFromNow <= 30 * 24 * 60 * 60 * 1000 &&
        expiryFromNow >= 30 * 24 * 59 * 60 * 1000,
      'policy (default) expiry written correctly',
    );
    t.strictEquals(
      pol.ignore.ID3[0]['*'].created.getTime(),
      new Date().getTime(),
      'created date is the current date',
    );
    clock.restore();
  } catch (e) {
    t.fail(e, 'ignore should succeed');
  }
});

test('snyk ignore - not authorized', async (t) => {
  const dir = await makeTmpDirectory();
  try {
    await cli.config('set', 'api=' + notAuthorizedApiKey);
    await cli.ignore({
      id: 'ID3',
      'policy-path': dir,
    });
  } catch (err) {
    t.throws(err, 'ignore should succeed');
  }
  try {
    await policy.load(dir);
  } catch (err) {
    t.pass('no policy file saved');
  }
});

test('snyk policy', async (t) => {
  await cli.policy();
  t.pass('policy called');

  try {
    await cli.policy('wrong/path');
  } catch (error) {
    t.match(error, PolicyNotFoundError);
  }
});

test('monitor', async (t) => {
  try {
    const res = await cli.monitor();
    t.match(res, /Monitoring/, 'monitor captured');
  } catch (error) {
    t.fail(error);
  }
});

test('monitor --json', async (t) => {
  try {
    const response = await cli.monitor(undefined, { json: true });
    const res = JSON.parse(response);

    if (isObject(res)) {
      t.pass('monitor outputted JSON');
    } else {
      t.fail('Failed parsing monitor JSON output');
    }

    const keyList = ['packageManager', 'manageUrl'];

    keyList.forEach((k) => {
      !get(res, k) ? t.fail(k + 'not found') : t.pass(k + ' found');
    });
  } catch (error) {
    t.fail(error);
  }
});

test('monitor --json no supported target files', async (t) => {
  try {
    chdirWorkspaces();
    await cli.monitor('no-supported-target-files', { json: true });
    t.fail('should have thrown');
  } catch (error) {
    // error.json is a stringified json used for error logging, parse before testing
    const jsonResponse = JSON.parse(error.json);

    if (isObject(jsonResponse)) {
      t.pass('monitor outputted JSON');
    } else {
      t.fail('Failed parsing monitor JSON output');
    }

    const keyList = ['error', 'path'];
    t.equals(jsonResponse.ok, false, 'result is an error');

    keyList.forEach((k) => {
      t.ok(get(jsonResponse, k, null), `${k} present`);
    });
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
  let value = 'api=' + oldKey;
  if (!oldKey) {
    key = 'unset';
    value = 'api';
  }
  await cli.config(key, value);
  t.pass('user config restored');
  if (oldEndPoint) {
    await cli.config('endpoint', oldEndPoint);
    t.pass('user endpoint restored');
  } else {
    t.pass('no endpoint');
  }
});
