import * as tap from 'tap';
import * as cli from '../../src/cli/commands';
import { fakeServer } from '../acceptance/fake-server';
import { getVersion } from '../../src/lib/version';
import { chdirWorkspaces } from '../acceptance/workspace-helper';
import { makeTmpDirectory } from '../utils';

export interface AcceptanceTests {
  language: string;
  tests: {
    [name: string]: any;
  };
}

import { GenericTests } from './cli-test/cli-test.generic.spec';

import { CocoapodsTests } from './cli-test/cli-test.cocoapods.spec';
import { ComposerTests } from './cli-test/cli-test.composer.spec';
import { DockerTests } from './cli-test/cli-test.docker.spec';
import { GoTests } from './cli-test/cli-test.go.spec';
import { GradleTests } from './cli-test/cli-test.gradle.spec';
import { MavenTests } from './cli-test/cli-test.maven.spec';
import { NpmTests } from './cli-test/cli-test.npm.spec';
import { NugetTests } from './cli-test/cli-test.nuget.spec';
import { PythonTests } from './cli-test/cli-test.python.spec';
import { RubyTests } from './cli-test/cli-test.ruby.spec';
import { SbtTests } from './cli-test/cli-test.sbt.spec';
import { YarnTests } from './cli-test/cli-test.yarn.spec';
import { ElixirTests } from './cli-test/cli-test.elixir.spec';
import { YarnWorkspacesTests } from './cli-test/cli-test.yarn-workspaces.spec';
import { AllProjectsTests } from './cli-test/cli-test.all-projects.spec';

const languageTests: AcceptanceTests[] = [
  CocoapodsTests,
  ComposerTests,
  DockerTests,
  GoTests,
  GradleTests,
  MavenTests,
  NpmTests,
  NugetTests,
  PythonTests,
  RubyTests,
  SbtTests,
  YarnTests,
  YarnWorkspacesTests,
  ElixirTests,
];

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
let versionNumber;
const server = fakeServer(BASE_API, apiKey);
const before = tap.runOnly ? only : test;
const after = tap.runOnly ? only : test;

// Should be after `process.env` setup.
import * as plugins from '../../src/lib/plugins/index';
import * as ecoSystemPlugins from '../../src/lib/ecosystems/plugins';
import { snykHttpClient } from '../../src/lib/request/snyk-http-client';

/*
  TODO: enable these tests, once we switch from node-tap
  I couldn't get them to run reliably under Windows, spent ~3 days on it
  I suspect it's either because of their structure or node-tap
  Wasn't getting any useful debug output from node-tap and blindly trying out changes didn't work
  - Jakub
*/

before('setup', async (t) => {
  process.env.XDG_CONFIG_HOME = await makeTmpDirectory();
  versionNumber = await getVersion();

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

test(GenericTests.language, async (t) => {
  for (const testName of Object.keys(GenericTests.tests)) {
    t.test(
      testName,
      GenericTests.tests[testName](
        { server, versionNumber, cli },
        { chdirWorkspaces },
      ),
    );
  }
});

test(AllProjectsTests.language, async (t) => {
  for (const testName of Object.keys(AllProjectsTests.tests)) {
    t.test(
      testName,
      AllProjectsTests.tests[testName](
        { server, versionNumber, cli, plugins },
        { chdirWorkspaces },
      ),
    );
  }
});

test('Languages', async (t) => {
  for (const languageTest of languageTests) {
    t.test(languageTest.language, async (tt) => {
      for (const testName of Object.keys(languageTest.tests)) {
        tt.test(
          testName,
          languageTest.tests[testName](
            { server, plugins, ecoSystemPlugins, versionNumber, cli },
            { chdirWorkspaces },
            snykHttpClient,
          ),
        );
        server.restore();
      }
    });
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
