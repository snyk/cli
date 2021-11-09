import * as util from 'util';
import { test } from 'tap';
import * as ciChecker from '../../src/lib/is-ci';
import * as dockerChecker from '../../src/lib/is-docker';
import { silenceLog } from '../utils';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as os from 'os';
import * as isDocker from '../../src/lib/is-docker';

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
    // .default is caused by Proxyquire is requiring without esmodules
    const res = await auth.default();
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
    await auth.default();
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
    await auth.default();
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
