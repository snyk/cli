import * as tap from 'tap';
import * as sinon from 'sinon';
import * as cli from '../../../src/cli/commands';
import { fakeServer } from '../fake-server';
import * as version from '../../../src/lib/version';

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
import * as plugins from '../../../src/lib/plugins/index';
import { chdirWorkspaces } from '../workspace-helper';

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

test('`wizard` for unsupported package managers', async (t) => {
  chdirWorkspaces();
  async function testUnsupported(data) {
    try {
      await cli.wizard({ file: data.file });
      t.fail('should fail');
    } catch (e) {
      return e;
    }
  }
  const cases = [
    { file: 'ruby-app/Gemfile.lock', type: 'RubyGems' },
    { file: 'maven-app/pom.xml', type: 'Maven' },
    { file: 'pip-app/requirements.txt', type: 'pip' },
    { file: 'sbt-app/build.sbt', type: 'SBT' },
    { file: 'gradle-app/build.gradle', type: 'Gradle' },
    { file: 'gradle-kotlin-dsl-app/build.gradle.kts', type: 'Gradle' },
    { file: 'golang-gomodules/go.mod', type: 'Go Modules' },
    { file: 'golang-app/Gopkg.lock', type: 'dep (Go)' },
    { file: 'golang-app/vendor/vendor.json', type: 'govendor' },
    { file: 'composer-app/composer.lock', type: 'Composer' },
    { file: 'cocoapods-app/Podfile.lock', type: 'CocoaPods' },
  ];
  const results = await Promise.all(cases.map(testUnsupported));
  results.map((result, i) => {
    const type = cases[i].type;
    t.equal(
      result,
      'Snyk wizard for ' + type + ' projects is not currently supported',
      type,
    );
  });
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

// fixture can be fixture path or object
function stubDockerPluginResponse(fixture: string | object, t) {
  const plugin = {
    async inspect() {
      return typeof fixture === 'object' ? fixture : require(fixture);
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin
    .withArgs(sinon.match.any, sinon.match({ docker: true }))
    .returns(plugin);
  t.teardown(loadPlugin.restore);

  return spyPlugin;
}
