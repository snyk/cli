import * as _ from 'lodash';
import { test } from 'tap';
import * as testUtils from '../utils';
import * as ciChecker from '../../src/lib/is-ci';
import * as sinon from 'sinon';
import proxyquire = require('proxyquire');
import { parse, Url } from 'url';
import * as policy from 'snyk-policy';
import stripAnsi from 'strip-ansi';
const port = process.env.PORT || process.env.SNYK_PORT || '12345';

const apiKey = '123456789';
const notAuthorizedApiKey = 'notAuthorized';
let oldKey;
let oldEndPoint;
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';

// tslint:disable-next-line:no-var-requires
const server = require('../cli-server')(
  process.env.SNYK_API,
  apiKey,
  notAuthorizedApiKey,
);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as cli from '../../src/cli/commands';
import { PolicyNotFoundError } from '../../src/lib/errors';
import { chdirWorkspaces } from '../acceptance/workspace-helper';

const before = test;
const after = test;

before('setup', (t) => {
  t.plan(3);
  cli.config('get', 'api').then((key) => {
    oldKey = key; // just in case
    t.pass('existing user config captured');
  });

  cli.config('get', 'endpoint').then((key) => {
    oldEndPoint = key; // just in case
    t.pass('existing user endpoint captured');
  });

  server.listen(port, () => {
    t.pass('started demo server');
  });
});

before('prime config', (t) => {
  cli
    .config('set', 'api=' + apiKey)
    .then(() => {
      t.pass('api token set');
    })
    .then(() => {
      return cli.config('unset', 'endpoint').then(() => {
        t.pass('endpoint removed');
      });
    })
    .catch(t.bailout)
    .then(t.end);
});

test('cli tests error paths', { timeout: 3000 }, (t) => {
  t.plan(3);

  cli
    .test('/', { json: true })
    .then((res) => {
      t.fail(res);
    })
    .catch((error) => {
      const errObj = JSON.parse(error.message);
      t.ok(errObj.error.length > 1, 'should display error message');
      t.match(errObj.path, '/', 'path property should be populated');
      t.pass('error json with correct output when one bad project specified');
      t.end();
    });
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

    if (_.isObject(res)) {
      t.pass('monitor outputted JSON');
    } else {
      t.fail('Failed parsing monitor JSON output');
    }

    const keyList = ['packageManager', 'manageUrl'];

    keyList.forEach((k) => {
      !_.get(res, k) ? t.fail(k + 'not found') : t.pass(k + ' found');
    });
  } catch (error) {
    t.fail(error);
  }
});

test('snyk ignore - all options', async (t) => {
  const fullPolicy = {
    ID: [
      {
        '*': {
          reason: 'REASON',
          expires: new Date('2017-10-07T00:00:00.000Z'),
        },
      },
    ],
  };
  const dir = testUtils.tmpdir();
  try {
    await cli.ignore({
      id: 'ID',
      reason: 'REASON',
      expiry: new Date('2017-10-07'),
      'policy-path': dir,
    });
  } catch (err) {
    t.throws(err, 'ignore should succeed');
  }
  const pol = await policy.load(dir);
  t.deepEquals(pol.ignore, fullPolicy, 'policy written correctly');
});

test('snyk ignore - no ID', async (t) => {
  const dir = testUtils.tmpdir();
  try {
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
  const dir = testUtils.tmpdir();
  try {
    await cli.ignore({
      id: 'ID3',
      'policy-path': dir,
    });
  } catch (e) {
    t.fail('ignore should succeed');
  }

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
    'policy (default) expiry wirtten correctly',
  );
});

test('snyk ignore - not authorized', async (t) => {
  const dir = testUtils.tmpdir();
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

test('auth via github', async (t) => {
  let tokenRequest: (Url & { token?: string }) | null = null;

  const openSpy = sinon.spy((url) => {
    tokenRequest = parse(url);
    tokenRequest.token = tokenRequest.query.split('=').pop();
  });

  const auth = proxyquire('../../src/cli/commands/auth', {
    open: openSpy,
  });
  sinon.stub(ciChecker, 'isCI').returns(false);

  const unhook = testUtils.silenceLog();

  try {
    const res = await auth();
    t.match(
      res,
      'Your account has been authenticated. Snyk is now ready to be used',
      'snyk auth worked',
    );
  } catch (e) {
    t.threw(e);
  }
  unhook();
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

test('monitor --json no supported target files', async (t) => {
  try {
    chdirWorkspaces();
    await cli.monitor('no-supported-target-files', { json: true });
    t.fail('should have thrown');
  } catch (error) {
    const jsonResponse = error.json;

    if (_.isObject(jsonResponse)) {
      t.pass('monitor outputted JSON');
    } else {
      t.fail('Failed parsing monitor JSON output');
    }

    const keyList = ['error', 'path'];
    t.equals(jsonResponse.ok, false, 'result is an error');

    keyList.forEach((k) => {
      t.ok(_.get(jsonResponse, k, null), `${k} present`);
    });
  }
});

after('teardown', (t) => {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  server.close(() => {
    t.pass('server shutdown');
    let key = 'set';
    let value = 'api=' + oldKey;
    if (!oldKey) {
      key = 'unset';
      value = 'api';
    }
    cli.config(key, value).then(() => {
      t.pass('user config restored');
      if (oldEndPoint) {
        cli.config('endpoint', oldEndPoint).then(() => {
          t.pass('user endpoint restored');
          t.end();
        });
      } else {
        t.pass('no endpoint');
        t.end();
      }
    });
  });
});
