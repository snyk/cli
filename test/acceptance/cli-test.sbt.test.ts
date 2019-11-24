import * as tap from 'tap';
import * as sinon from 'sinon';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as version from '../../src/lib/version';

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
import * as _ from 'lodash';

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

test('`test sbt-simple-struts`', async (t) => {
  chdirWorkspaces();

  const plugin = {
    async inspect() {
      return {
        plugin: { name: 'sbt' },
        package: require('./workspaces/sbt-simple-struts/dep-tree.json'),
      };
    },
  };
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin.returns(plugin);

  t.teardown(() => {
    loadPlugin.restore();
  });

  server.setNextResponse(
    require('./workspaces/sbt-simple-struts/test-graph-result.json'),
  );

  try {
    await cli.test('sbt-simple-struts', { json: true });

    t.fail('should have thrown');
  } catch (err) {
    const res = JSON.parse(err.message);

    const expected = require('./workspaces/sbt-simple-struts/legacy-res-json.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities', 'packageManager']),
      _.omit(expected, ['vulnerabilities', 'packageManager']),
      'metadata is ok',
    );
    // NOTE: decided to keep this discrepancy
    t.is(
      res.packageManager,
      'sbt',
      'pacakgeManager is sbt, altough it was mavn with the legacy api',
    );
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same',
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

function chdirWorkspaces(subdir = '') {
  process.chdir(__dirname + '/workspaces' + (subdir ? '/' + subdir : ''));
}
