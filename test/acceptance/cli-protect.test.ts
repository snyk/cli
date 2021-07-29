import { test } from 'tap';
import { exec } from 'child_process';
import { config as userConfig } from '../../src/lib/user-config';
import { sep } from 'path';
import * as tap from 'tap';
import * as path from 'path';
import * as fs from 'fs';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import { chdirWorkspaces } from './workspace-helper';

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

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
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

// @later: remove this config stuff.
// Was copied straight from ../src/cli-server.js
before('prime config', async (t) => {
  await cli.config('set', 'api=' + apiKey);
  t.pass('api token set');
  await cli.config('unset', 'endpoint');
  t.pass('endpoint removed');
  t.end();
});
const main = './bin/snyk'.replace(/\//g, sep);

test('`protect` should not fail for unauthorized users', (t) => {
  t.plan(1);

  const apiUserConfig = userConfig.get('api');
  // temporally remove api param in userConfig to test for unauthenticated users
  userConfig.delete('api');

  const absoluteMain = path.join(process.cwd(), main);
  chdirWorkspaces('npm-package-policy');

  exec(`node ${absoluteMain} protect --file=`, (err, stdout) => {
    if (err) {
      throw err;
    }
    t.match(
      stdout.trim(),
      'Successfully applied Snyk patches',
      'correct output for unauthenticated user',
    );

    // Restore api param
    userConfig.set('api', apiUserConfig);
  });
});

test('`protect` for unsupported package managers', async (t) => {
  chdirWorkspaces();
  async function testUnsupported(data) {
    try {
      await cli.protect({ file: data.file });
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
      result.message,
      'Snyk protect for ' + type + ' projects is not currently supported',
      type,
    );
  });
});

test('`protect --policy-path`', async (tt) => {
  tt.plan(2);
  chdirWorkspaces('npm-package-policy');

  tt.test('default policy', async (t) => {
    const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    const vulns = require('./fixtures/npm-package-policy/test-graph-result.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);
    try {
      await cli.protect();
      t.fail('should fail');
    } catch (err) {
      const req = server.popRequest();
      const policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');
    }
  });

  tt.test('custom policy path', async (t) => {
    const expected = fs.readFileSync(
      path.join('custom-location', '.snyk'),
      'utf8',
    );
    const vulns = require('./fixtures/npm-package-policy/vulns.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    await cli.protect({
      'policy-path': 'custom-location',
    });
    const req = server.popRequest();
    const policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');
  });
});

test('`protect` with no policy', async (t) => {
  t.plan(1);
  chdirWorkspaces('npm-with-dep-missing-policy');

  const vulns = require('./fixtures/npm-package-policy/vulns.json');
  server.setNextResponse(vulns);

  const projectPolicy = fs
    .readFileSync(__dirname + '/workspaces/npm-with-dep-missing-policy/.snyk')
    .toString();

  try {
    await cli.protect();
  } catch (e) {
    console.log(e); // this is expected
  }
  const req = server.popRequest();
  const policySentToServer = req.body.policy;
  t.equal(policySentToServer, projectPolicy, 'sends correct policy');

  t.end();
});

// @later: try and remove this config stuff
// Was copied straight from ../src/cli-server.js
test('teardown', async (t) => {
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
