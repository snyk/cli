import * as tap from 'tap';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as version from '../../src/lib/version';
import { chdirWorkspaces, getWorkspaceJSON } from './workspace-helper';

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
const upgradableResult = getWorkspaceJSON(
  'fail-on',
  'upgradable',
  'vulns-result.json',
);
const patchableResult = getWorkspaceJSON(
  'fail-on',
  'patchable',
  'vulns-result.json',
);
const pinnableVulnsResult = getWorkspaceJSON(
  'fail-on',
  'pinnable',
  'vulns-result.json',
);

// snyk test stub responses
const pinnableVulns = getWorkspaceJSON('fail-on', 'pinnable', 'vulns.json');

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

// --fail-on=all
test('test project with no vulns and --fail-on=all', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-vulns', {
      failOn: 'all',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with no fixable and --fail-on=all', async (t) => {
  try {
    server.setNextResponse(noFixableResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-fixable', {
      failOn: 'all',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with upgradable and --fail-on=all', async (t) => {
  try {
    server.setNextResponse(upgradableResult);
    chdirWorkspaces('fail-on');
    await cli.test('upgradable', {
      failOn: 'all',
    });
    t.fail('expected exception to be thrown');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with patchable and --fail-on=all', async (t) => {
  try {
    server.setNextResponse(patchableResult);
    chdirWorkspaces('fail-on');
    await cli.test('patchable', {
      failOn: 'all',
    });
    t.fail('expected exception to be thrown');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with upgradable and --fail-on=all --json', async (t) => {
  try {
    server.setNextResponse(upgradableResult);
    chdirWorkspaces('fail-on');
    await cli.test('upgradable', {
      failOn: 'all',
      json: true,
    });
    t.fail('expected exception to be thrown');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with patchable and --fail-on=all --json', async (t) => {
  try {
    server.setNextResponse(patchableResult);
    chdirWorkspaces('fail-on');
    await cli.test('patchable', {
      failOn: 'all',
      json: true,
    });
    t.fail('expected exception to be thrown');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with no fixable and --fail-on=all --json', async (t) => {
  try {
    server.setNextResponse(noFixableResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-fixable', {
      failOn: 'all',
      json: true,
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test project with no vulns and --fail-on=all --json', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-vulns', {
      failOn: 'all',
      json: true,
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

// --fail-on=upgradable
test('test project with no vulns and --fail-on=upgradable', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-vulns', {
      failOn: 'upgradable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with no fixable and --fail-on=upgradable', async (t) => {
  try {
    server.setNextResponse(noFixableResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-fixable', {
      failOn: 'upgradable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with upgradable and --fail-on=upgradable', async (t) => {
  try {
    server.setNextResponse(upgradableResult);
    chdirWorkspaces('fail-on');
    await cli.test('upgradable', {
      failOn: 'upgradable',
    });
    t.fail('expected test to throw exception');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});
test('test vulnerable project with patchable and --fail-on=upgradable', async (t) => {
  try {
    server.setNextResponse(patchableResult);
    chdirWorkspaces('fail-on');
    await cli.test('patchable', {
      failOn: 'upgradable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with upgradable and --fail-on=upgradable --json', async (t) => {
  try {
    server.setNextResponse(upgradableResult);
    chdirWorkspaces('fail-on');
    await cli.test('upgradable', {
      failOn: 'upgradable',
      json: true,
    });
    t.fail('expected test to throw exception');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with patchable and --fail-on=upgradable --json', async (t) => {
  try {
    server.setNextResponse(patchableResult);
    chdirWorkspaces('fail-on');
    await cli.test('patchable', {
      failOn: 'upgradable',
      json: true,
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with no fixable and --fail-on=upgradable --json', async (t) => {
  try {
    server.setNextResponse(noFixableResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-fixable', {
      failOn: 'upgradable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test project with no vulns and --fail-on=upgradable --json', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-vulns', {
      failOn: 'upgradable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

// --fail-on=patchable
test('test project with no vulns and --fail-on=patchable', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-vulns', {
      failOn: 'patchable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with no fixable and --fail-on=patchable', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-fixable', {
      failOn: 'patchable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with patchable and --fail-on=patchable', async (t) => {
  try {
    server.setNextResponse(patchableResult);
    chdirWorkspaces('fail-on');
    await cli.test('patchable', {
      failOn: 'patchable',
    });
    t.fail('expected test to throw exception');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with upgradable and --fail-on=patchable', async (t) => {
  try {
    server.setNextResponse(upgradableResult);
    chdirWorkspaces('fail-on');
    await cli.test('upgradable', {
      failOn: 'patchable',
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test vulnerable project with patchable and --fail-on=patchable --json', async (t) => {
  try {
    server.setNextResponse(patchableResult);
    chdirWorkspaces('fail-on');
    await cli.test('patchable', {
      failOn: 'patchable',
      json: true,
    });
    t.fail('expected test to throw exception');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with upgradable and --fail-on=patchable --json', async (t) => {
  try {
    server.setNextResponse(patchableResult);
    chdirWorkspaces('fail-on');
    await cli.test('patchable', {
      failOn: 'patchable',
      json: true,
    });
    t.fail('expected test to throw exception');
  } catch (err) {
    t.equal(err.code, 'VULNS', 'should throw exception');
  }
});

test('test vulnerable project with no fixable and --fail-on=patchable --json', async (t) => {
  try {
    server.setNextResponse(noFixableResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-fixable', {
      failOn: 'patchable',
      json: true,
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('test project with no vulns and --fail-on=patchable --json', async (t) => {
  try {
    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-vulns', {
      failOn: 'patchable',
      json: true,
    });
    t.pass('should not throw exception');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
});

// test invalid arg
test('test project with --fail-on=invalid', async (t) => {
  try {
    chdirWorkspaces();
    await cli.test('npm-package', {
      failOn: 'invalid',
    });
    t.fail('expected invalid fail-on to throw exception');
  } catch (err) {
    t.equal(
      err,
      'Invalid fail on argument, please use one of: all | upgradable | patchable',
    );
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
