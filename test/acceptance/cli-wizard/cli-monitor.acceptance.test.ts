import * as tap from 'tap';
import * as fs from 'fs';
import * as cli from '../../../src/cli/commands';
import { fakeServer } from '../fake-server';

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

// Should be after `process.env` setup.
import { chdirWorkspaces } from '../workspace-helper';

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

test('`wizard` for supported package managers', async (t) => {
  chdirWorkspaces('npm-package-no-vulns');
  // TODO(boost): confirm that monitor is called with correct params
  // this currently fails as fake-server is not called?
  // const monitorSpy = sinon.stub(snykMonitor, 'monitor').callThrough();
  const result = await cli.wizard({ file: 'package-lock.json' });
  t.contains(
    result,
    'You can see a snapshot of your dependencies here',
    'wizard saves snapshot',
  );
  // t.equal(monitorSpy.calledOnceWith(
  //   'npm-package-no-vulns',
  //   {} as MonitorMeta,
  //   [] as ScannedProject,
  //   {} as Options,
  //   {} as PluginMetadata,
  // ), true);
  try {
    fs.unlinkSync('./.snyk');
  } catch (err) {
    throw new Error(
      'Failed to delete test/acceptance/workspaces/npm-package-no-vulns/.snyk',
    );
  }
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

after('teardown', async (t) => {
  t.plan(4);

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
    await cli.config('endpoint', oldendpoint);
    t.pass('user endpoint restored');
    t.end();
  } else {
    t.pass('no endpoint');
    t.end();
  }
});
