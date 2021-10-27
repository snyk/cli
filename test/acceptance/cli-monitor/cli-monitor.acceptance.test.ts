import * as tap from 'tap';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as cli from '../../../src/cli/commands';
import { fakeServer } from '../fake-server';
import * as subProcess from '../../../src/lib/sub-process';
import { getVersion } from '../../../src/lib/version';
import { chdirWorkspaces, getWorkspaceJSON } from '../workspace-helper';
const isEmpty = require('lodash.isempty');
const isObject = require('lodash.isobject');
const get = require('lodash.get');

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import { AllProjectsTests } from './cli-monitor.all-projects.spec';

const { test, only, beforeEach } = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)

const port = (process.env.PORT = process.env.SNYK_PORT = '12345');
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
import * as plugins from '../../../src/lib/plugins/index';
import * as ecosystemPlugins from '../../../src/lib/ecosystems/plugins';
import { createCallGraph } from '../../utils';
import { DepGraphBuilder } from '@snyk/dep-graph';
import * as depGraphLib from '@snyk/dep-graph';

/*
  TODO: enable these tests, once we switch from node-tap
  I couldn't get them to run reliably under Windows, spent ~3 days on it
  I suspect it's either because of their structure or node-tap
  Wasn't getting any useful debug output from node-tap and blindly trying out changes didn't work
  - Jakub
*/

const isWindows =
  require('os-name')()
    .toLowerCase()
    .indexOf('windows') === 0;

if (!isWindows) {
  // @later: remove this config stuff.
  // Was copied straight from ../src/cli-server.js
  before('setup', async (t) => {
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

  // @later: remove this config stuff.
  // Was copied straight from ../src/cli-server.js
  before('prime config', async (t) => {
    await cli.config('set', 'api=' + apiKey);
    t.pass('api token set');
    await cli.config('unset', 'endpoint');
    t.pass('endpoint removed');
    t.end();
  });

  beforeEach(async () => {
    server.restore();
  });

  test(AllProjectsTests.language, async (t) => {
    for (const testName of Object.keys(AllProjectsTests.tests)) {
      t.beforeEach(async () => {
        server.restore();
      });

      t.test(
        testName,
        AllProjectsTests.tests[testName](
          { server, versionNumber, cli, plugins },
          { chdirWorkspaces },
        ),
      );
    }
  });

  /**
   * `monitor`
   */
  test('`monitor --policy-path`', async (tt) => {
    tt.plan(2);
    chdirWorkspaces('npm-package-policy');

    tt.test('default policy', async (t) => {
      await cli.monitor('.');
      const req = server.popRequest();
      const policyString = req.body.policy;
      const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
      t.equal(policyString, expected, 'sends correct policy');
    });

    tt.test('custom policy path', async (t) => {
      await cli.monitor('.', {
        'policy-path': 'custom-location',
        json: true,
      });
      const req = server.popRequest();
      const policyString = req.body.policy;
      const expected = fs.readFileSync(
        path.join('custom-location', '.snyk'),
        'utf8',
      );
      t.equal(policyString, expected, 'sends correct policy');
    });
  });

  test('`monitor non-existing --json`', async (t) => {
    chdirWorkspaces();
    try {
      await cli.monitor('non-existing', { json: true });
      t.fail('should have failed');
    } catch (err) {
      const errObj = JSON.parse(err.message);
      t.notOk(errObj.ok, 'ok object should be false');
      t.match(errObj.error, 'is not a valid path', 'show err message');
      t.match(errObj.path, 'non-existing', 'should show specified path');
      t.pass('throws err');
    }
  });

  test('`monitor missing container image`', async (t) => {
    chdirWorkspaces();
    try {
      await cli.monitor({ docker: true });
      t.fail('should have failed');
    } catch (err) {
      t.match(
        err.message,
        'Could not detect an image. Specify an image name to scan and try running the command again.',
        'show err message',
      );
      t.pass('throws err');
    }
  });

  test('`monitor non-existing`', async (t) => {
    chdirWorkspaces();
    try {
      await cli.monitor('non-existing', { json: false });
      t.fail('should have failed');
    } catch (err) {
      t.match(err.message, 'is not a valid path', 'show err message');
      t.pass('throws err');
    }
  });

  test('monitor for package with no name', async (t) => {
    t.plan(1);
    await cli.monitor({
      file: __dirname + '/../../fixtures/package-sans-name/package.json',
    });
    t.pass('succeed');
  });

  test('monitor for package with no name in lockfile', async (t) => {
    t.plan(1);
    await cli.monitor({
      file:
        __dirname +
        '/../../fixtures/package-sans-name-lockfile/package-lock.json',
    });
    t.pass('succeed');
  });

  test('`monitor npm-package`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
    const debug = depGraphJSON.pkgs.find((pkg) => pkg.info.name === 'debug');
    const objectAssign = depGraphJSON.pkgs.find(
      (pkg) => pkg.info.name === 'object-assign',
    );
    t.match(req.url, '/monitor/npm/graph', 'puts at correct url');
    t.ok(debug, 'dependency');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    t.notOk(objectAssign, 'no dev dependency');
    t.notOk(depGraphJSON.from, 'no "from" array on root');
    t.notOk(debug.from, 'no "from" array on dep');
    t.notOk(
      req.body.meta.prePruneDepCount,
      "doesn't send meta.prePruneDepCount",
    );
  });

  test('`monitor npm-out-of-sync graph monitor`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-out-of-sync-graph', {
      strictOutOfSync: false,
    });
    const req = server.popRequest();
    t.match(req.url, '/monitor/npm/graph', 'puts at correct url');
    t.true(!isEmpty(req.body.depGraphJSON), 'sends depGraphJSON');
    t.deepEqual(
      req.body.meta.missingDeps,
      ['body-parser@^1.18.2'],
      'missingDeps passed',
    );
    t.notOk(
      req.body.depGraphJSON.pkgs.find((pkg) => pkg.name === 'body-parser'),
      'filetered out missingLockFileEntry',
    );
  });

  test('`monitor gradle --prune-repeated-subdependencies`', async (t) => {
    chdirWorkspaces();

    const fixturePath = path.join(
      __dirname,
      '..',
      '..',
      'fixtures',
      'gradle-prune-repeated-deps',
    );

    const manifestFile = path.join(fixturePath, 'build.gradle');

    await cli.monitor({
      file: manifestFile,
      pruneRepeatedSubdependencies: true,
    });

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/gradle/graph', 'puts at correct url');
    t.deepEqual(req.body.meta.monitorGraph, true, 'correct meta set');
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);

    const actualDepGraph = JSON.stringify(depGraphJSON);
    const expectedPrunedDepGraph = fs.readFileSync(
      path.join(fixturePath, 'gradle-pruned-dep-graph.json'),
      'utf8',
    );

    t.ok(expectedPrunedDepGraph);

    t.equal(
      actualDepGraph,
      expectedPrunedDepGraph,
      'verify if the generated depGraph from snyk monitor has been pruned',
    );
  });

  test('`monitor npm-package-pruneable --prune-repeated-subdependencies`', async (t) => {
    chdirWorkspaces();

    await cli.monitor('npm-package-pruneable', {
      pruneRepeatedSubdependencies: true,
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/npm/graph', 'puts at correct url');
    t.deepEqual(req.body.meta.monitorGraph, true, 'correct meta set');
    t.ok(req.body.meta.prePruneDepCount, 'sends meta.prePruneDepCount');
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);

    const packageC1 = depGraphJSON.graph.nodes.find(
      (pkg) => pkg.nodeId === 'c@1.0.0|1',
    );
    const packageC2 = depGraphJSON.graph.nodes.find(
      (pkg) => pkg.nodeId === 'c@1.0.0|2',
    );
    t.notOk(packageC1.info.labels.pruned, 'a.d.c first instance is not pruned');
    t.ok(packageC2.info.labels.pruned, 'a.d.c second instance is pruned');
    t.ok(packageC1.deps.length, 'a.d.c has dependencies');
    t.notOk(packageC2.deps.length, 'a.d.c has no dependencies');
  });

  test('`monitor sbt package`', async (t) => {
    chdirWorkspaces();

    const plugin = {
      async inspect() {
        return {
          plugin: { name: 'sbt' },
          package: require('../workspaces/sbt-simple-struts/monitor-graph-result.json'),
        };
      },
    };

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    loadPlugin.returns(plugin);

    t.teardown(() => {
      loadPlugin.restore();
    });

    await cli.monitor('sbt-simple-struts');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/sbt/graph', 'puts at correct url');
    t.true(!isEmpty(req.body.depGraphJSON), 'sends depGraphJSON');
    if (process.platform === 'win32') {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '\\test\\acceptance\\workspaces\\sbt-simple-struts\\build.sbt',
        ),
        'matching file path',
      );
    } else {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '/test/acceptance/workspaces/sbt-simple-struts/build.sbt',
        ),
        'matching file path',
      );
    }
  });

  test('`monitor yarn-package`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('yarn-package');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/yarn/graph', 'puts at correct url');

    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
    const debug = depGraphJSON.pkgs.find((pkg) => pkg.info.name === 'debug');
    const objectAssign = depGraphJSON.pkgs.find(
      (pkg) => pkg.info.name === 'object-assign',
    );

    t.ok(debug, 'dependency');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    t.notOk(objectAssign, 'no dev dependency');
    t.notOk(depGraphJSON.from, 'no "from" array on root');
    t.notOk(debug.from, 'no "from" array on dep');
    if (process.platform === 'win32') {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '\\test\\acceptance\\workspaces\\yarn-package\\yarn.lock',
        ),
        'matching file path win32',
      );
    } else {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '/test/acceptance/workspaces/yarn-package/yarn.lock',
        ),
        'matching file path',
      );
    }
  });

  test('`monitor yarn v2 project`', async (t) => {
    chdirWorkspaces();

    await cli.monitor('yarn-v2');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/yarn/graph', 'puts at correct url');

    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
    const lodash = depGraphJSON.pkgs.find((pkg) => pkg.info.name === 'lodash');

    t.ok(lodash, 'dependency');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    t.notOk(depGraphJSON.from, 'no "from" array on root');
    t.notOk(lodash.from, 'no "from" array on dep');
    if (process.platform === 'win32') {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '\\test\\acceptance\\workspaces\\yarn-v2\\yarn.lock',
        ),
        'matching file path win32',
      );
    } else {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '/test/acceptance/workspaces/yarn-v2/yarn.lock',
        ),
        'matching file path',
      );
    }
  });

  test('`monitor yarn-package from within folder`', async (t) => {
    chdirWorkspaces('yarn-package');
    await cli.monitor();
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
    const debug = depGraphJSON.pkgs.find((pkg) => pkg.info.name === 'debug');
    const objectAssign = depGraphJSON.pkgs.find(
      (pkg) => pkg.info.name === 'object-assign',
    );

    t.ok(debug, 'dependency');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    t.notOk(objectAssign, 'no dev dependency');
    t.notOk(depGraphJSON.from, 'no "from" array on root');
    t.notOk(debug.from, 'no "from" array on dep');

    t.match(req.url, '/monitor/yarn/graph', 'puts at correct url');
    if (process.platform === 'win32') {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '\\test\\acceptance\\workspaces\\yarn-package\\yarn.lock',
        ),
        'matching file path',
      );
    } else {
      t.true(
        req.body.targetFileRelativePath.endsWith(
          '/test/acceptance/workspaces/yarn-package/yarn.lock',
        ),
        'matching file path',
      );
    }
  });

  test('`monitor npm-package with custom --project-name`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package', {
      'project-name': 'custom-project-name',
    });
    const req = server.popRequest();
    t.equal(req.body.meta.projectName, 'custom-project-name');
  });

  test('`monitor npm-package with --project-business-criticality`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package', {
      'project-business-criticality': 'high,medium',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.projectAttributes.criticality, ['high', 'medium']);
  });

  test('`monitor npm-package with --project-environment`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package', {
      'project-environment': 'frontend,backend',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.projectAttributes.environment, [
      'frontend',
      'backend',
    ]);
  });

  test('`monitor npm-package with --project-lifecycle`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package', {
      'project-lifecycle': 'production,sandbox',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.projectAttributes.lifecycle, [
      'production',
      'sandbox',
    ]);
  });

  test('`monitor npm-package with --project-tags`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package', {
      'project-tags': 'department=finance,team=outbound-payments',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.tags, [
      { key: 'department', value: 'finance' },
      { key: 'team', value: 'outbound-payments' },
    ]);
  });

  test('`monitor npm-package with custom --remote-repo-url`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package', {
      'remote-repo-url': 'a-fake-remote',
    });
    const req = server.popRequest();
    t.equal(req.body.target.remoteUrl, 'a-fake-remote');
  });

  test('it fails when the custom --remote-repo-url is invalid', async (t) => {
    t.plan(1);
    chdirWorkspaces();
    try {
      await cli.monitor('npm-package', {
        'remote-repo-url': true,
      });
      t.fail('should not succeed');
    } catch (err) {
      t.contains(
        err,
        /Invalid argument provided for --remote-repo-url/,
        'correct error message',
      );
    }
  });

  test('`monitor npm-package with dev dep flag`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('npm-package', { dev: true });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    const depGraphJSON = req.body.depGraphJSON;
    const debug = depGraphJSON.pkgs.find((pkg) => pkg.info.name === 'debug');
    const objectAssign = depGraphJSON.pkgs.find(
      (pkg) => pkg.info.name === 'object-assign',
    );
    t.ok(depGraphJSON, 'monitor is a depgraph format');
    t.match(req.url, '/monitor/npm/graph', 'puts at correct url');
    t.ok(debug, 'debug dependency found');
    t.ok(objectAssign, 'includes dev dependency');
  });

  test('`monitor yarn-package with dev dep flag`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('yarn-package', { dev: true });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/yarn/graph', 'puts at correct url');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
    const debug = depGraphJSON.pkgs.find((pkg) => pkg.info.name === 'debug');
    const objectAssign = depGraphJSON.pkgs.find(
      (pkg) => pkg.info.name === 'object-assign',
    );

    t.ok(debug, 'dependency');
    t.ok(objectAssign, 'dev dependency');
  });

  test('`monitor yarn-workspaces with --yarn-workspaces flag`', async (t) => {
    chdirWorkspaces();
    const res = await cli.monitor('yarn-workspaces', {
      yarnWorkspaces: true,
      detectionDepth: 4,
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/yarn/graph', 'puts at correct url');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    t.match(
      res,
      'Monitoring yarn-workspaces (apples)',
      'apples workspace found',
    );
    t.match(
      res,
      'Monitoring yarn-workspaces (package.json)',
      'root workspace found',
    );
    t.match(
      res,
      'Monitoring yarn-workspaces (tomatoes)',
      'tomatoes workspace found',
    );
  });

  test('`monitor yarn-workspaces without --yarn-workspaces flag`', async (t) => {
    chdirWorkspaces();
    const res = await cli.monitor('yarn-workspaces');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/yarn/graph', 'puts at correct url');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    t.notOk(res.includes('tomatoes'), 'tomatoes workspace not found');
    t.notOk(res.includes('apples'), 'apples workspace not found');
    t.match(
      res,
      'Monitoring yarn-workspaces (package.json)',
      'root workspace found',
    );
  });

  test('`monitor ruby-app`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('ruby-app');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/rubygems/graph', 'puts at correct url');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
  });

  test('`monitor maven-app`', async (t) => {
    chdirWorkspaces();
    stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
    await cli.monitor('maven-app', { file: 'pom.xml', dev: true });
    const req = server.popRequest();
    const pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.equal(pkg.name, 'com.mycompany.app:maven-app', 'specifies name');
    t.ok(pkg.dependencies['junit:junit'], 'specifies dependency');
    t.equal(
      pkg.dependencies['junit:junit'].name,
      'junit:junit',
      'specifies dependency name',
    );
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(pkg.dependencies['junit:junit'].from, 'no "from" array on dep');
  });

  test('`monitor maven-multi-app`', async (t) => {
    chdirWorkspaces();
    stubExec(t, 'maven-multi-app/mvn-dep-tree-stdout.txt');
    await cli.monitor('maven-multi-app', { file: 'pom.xml' });
    const req = server.popRequest();
    const pkg = req.body.package;
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.equal(pkg.name, 'com.mycompany.app:maven-multi-app', 'specifies name');
    t.ok(
      pkg.dependencies['com.mycompany.app:simple-child'],
      'specifies dependency',
    );
    t.notOk(pkg.from, 'no "from" array on root');
    t.notOk(
      pkg.dependencies['com.mycompany.app:simple-child'].from,
      'no "from" array on dep',
    );
  });

  test('`monitor maven-multi-app with --project-business-criticality`', async (t) => {
    chdirWorkspaces();
    stubExec(t, 'maven-multi-app/mvn-dep-tree-stdout.txt');
    await cli.monitor('maven-multi-app', {
      file: 'pom.xml',
      'project-business-criticality': 'high,medium',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.projectAttributes.criticality, ['high', 'medium']);
  });

  test('`monitor maven-multi-app with ---project-tags`', async (t) => {
    chdirWorkspaces();
    stubExec(t, 'maven-multi-app/mvn-dep-tree-stdout.txt');
    await cli.monitor('maven-multi-app', {
      file: 'pom.xml',
      'project-tags': 'department=finance,team=outbound-payments',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.tags, [
      { key: 'department', value: 'finance' },
      { key: 'team', value: 'outbound-payments' },
    ]);
  });

  test('`monitor maven-multi-app with --project-environment`', async (t) => {
    chdirWorkspaces();
    stubExec(t, 'maven-multi-app/mvn-dep-tree-stdout.txt');
    await cli.monitor('maven-multi-app', {
      file: 'pom.xml',
      'project-environment': 'frontend,backend',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.projectAttributes.environment, [
      'frontend',
      'backend',
    ]);
  });

  test('`monitor maven-multi-app with --project-lifecycle`', async (t) => {
    chdirWorkspaces();
    stubExec(t, 'maven-multi-app/mvn-dep-tree-stdout.txt');
    await cli.monitor('maven-multi-app', {
      file: 'pom.xml',
      'project-lifecycle': 'production,sandbox',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.projectAttributes.lifecycle, [
      'production',
      'sandbox',
    ]);
  });

  test('`monitor maven-app-with-jars --file=example.jar` sends package info', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          package: {},
          plugin: { name: 'testplugin', runtime: 'testruntime' },
        };
      },
    };
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('maven').returns(plugin);

    await cli.monitor('maven-app-with-jars', {
      file: 'example.jar',
    });

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/maven', 'puts at correct url');
  });

  test('`monitor maven-app-with-jars --file=example.war` sends package info', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          package: {},
          plugin: { name: 'testplugin', runtime: 'testruntime' },
        };
      },
    };
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('maven').returns(plugin);

    await cli.monitor('maven-app-with-jars', {
      file: 'example.war',
    });

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/maven', 'puts at correct url');
  });

  test('`monitor maven-app-with-jars --scan-all-unmanaged` sends package info', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          package: {},
          plugin: { name: 'testplugin', runtime: 'testruntime' },
        };
      },
    };
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('maven').returns(plugin);
    await cli.monitor('maven-app-with-jars', {
      scanAllUnmanaged: true,
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/maven', 'puts at correct url');
  });

  test('`monitor maven --reachable-vulns` sends call graph', async (t) => {
    chdirWorkspaces();
    const callGraphPayload = require('../fixtures/call-graphs/maven.json');
    const callGraph = createCallGraph(callGraphPayload);
    const plugin = {
      async inspect() {
        return {
          package: {},
          plugin: { name: 'testplugin', runtime: 'testruntime' },
          callGraph,
        };
      },
    };
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('maven').returns(plugin);

    await cli.monitor('maven-app-with-jars', {
      file: 'example.jar',
    });

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.match(req.url, '/monitor/maven', 'puts at correct url');
    t.deepEqual(
      req.body.callGraph,
      callGraphPayload,
      'sends correct call graph',
    );
  });

  test('`monitor yarn-app`', async (t) => {
    chdirWorkspaces('yarn-app');
    await cli.monitor();
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
    const marked = depGraphJSON.pkgs.find((pkg) => pkg.info.name === 'marked');
    t.match(req.url, '/monitor/yarn/graph', 'puts at correct url');
    t.notOk(depGraphJSON.from, 'no "from" array on root');
    t.ok(marked, 'specifies dependency');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
  });

  test('`monitor pip-app with dep-graph`', async (t) => {
    chdirWorkspaces();

    const depGraphBuilder = new DepGraphBuilder(
      { name: 'pip' },
      { name: 'pip-app', version: '0.0.1' },
    );

    depGraphBuilder.addPkgNode(
      { name: 'oauth2', version: '1.1.3' },
      'oauth2@1.1.3',
    );

    depGraphBuilder.addPkgNode(
      { name: 'jinja2', version: '2.7.2' },
      'jinja2@2.7.2',
    );

    depGraphBuilder.addPkgNode({ name: 'rsa', version: '3.0.1' }, 'rsa@3.0.1');

    depGraphBuilder.addPkgNode(
      { name: 'django', version: '1.6.1' },
      'django@1.6.1',
    );

    depGraphBuilder.connectDep('root-node', 'oauth2@1.1.3');
    depGraphBuilder.connectDep('root-node', 'jinja2@2.7.2');
    depGraphBuilder.connectDep('root-node', 'django@1.6.1');

    const dependencyGraph = depGraphBuilder.build();

    const plugin = {
      async inspect() {
        return {
          plugin: { name: 'pip' },
          dependencyGraph,
        };
      },
    };

    const spyPlugin = sinon.spy(plugin, 'inspect');
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('pip').returns(plugin);

    await cli.monitor('pip-app');

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/pip/graph', 'puts at correct url');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'pip-app',
        'requirements.txt',
        {
          args: null,
          file: 'requirements.txt',
          packageManager: 'pip',
          path: 'pip-app',
        },
      ],
      'calls python plugin',
    );
  });

  test('`monitor poetry-app`', async (t) => {
    chdirWorkspaces();
    await cli.monitor('poetry-app');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/poetry/graph', 'puts at correct url');
    t.equal(req.body.targetFile, 'pyproject.toml', 'sends targetFile');
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
  });

  test('`monitor pip-app --file=requirements.txt`', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: {
            name: 'snyk-python-plugin',
            runtime: 'Python',
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('pip').returns(plugin);

    await cli.monitor('pip-app', {
      file: 'requirements.txt',
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/pip', 'puts at correct url');
    t.notOk(req.body.targetFile, 'doesnt send the targetFile');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'pip-app',
        'requirements.txt',
        {
          args: null,
          file: 'requirements.txt',
          packageManager: 'pip',
          path: 'pip-app',
        },
      ],
      'calls python plugin',
    );
  });

  test('`monitor gradle-app`', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: {
            name: 'testplugin',
            runtime: 'testruntime',
            meta: {
              allSubProjectNames: ['foo', 'bar'],
            },
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('gradle').returns(plugin);

    const output = await cli.monitor('gradle-app');
    t.match(output, '(2)', '2 sub projects found');
    t.match(
      output,
      /use --all-sub-projects flag to scan all sub-projects/,
      'all-sub-projects flag is suggested',
    );
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/gradle', 'puts at correct url');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'gradle-app',
        'build.gradle',
        {
          args: null,
          packageManager: 'gradle',
          file: 'build.gradle',
          path: 'gradle-app',
        },
      ],
      'calls gradle plugin',
    );
  });

  test('`monitor gradle-app with dep-graph`', async (t) => {
    chdirWorkspaces();

    const depGraphBuilder = new DepGraphBuilder(
      { name: 'gradle' },
      { name: 'gradle-app', version: '1.1.5-SNAPSHOT' },
    );

    depGraphBuilder.addPkgNode(
      { name: 'ch.qos.logback:logback-core', version: '1.0.13' },
      'ch.qos.logback:logback-core@1.0.13',
    );

    depGraphBuilder.addPkgNode(
      { name: 'org.bouncycastle:bcprov-jdk15on', version: '1.48' },
      'org.bouncycastle:bcprov-jdk15on@1.48',
    );

    depGraphBuilder.connectDep(
      'root-node',
      'ch.qos.logback:logback-core@1.0.13',
    );
    depGraphBuilder.connectDep(
      'root-node',
      'org.bouncycastle:bcprov-jdk15on@1.48',
    );

    const dependencyGraph = depGraphBuilder.build();

    const plugin = {
      async inspect() {
        return {
          plugin: { name: 'gradle' },
          dependencyGraph,
        };
      },
    };

    const spyPlugin = sinon.spy(plugin, 'inspect');
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('gradle').returns(plugin);

    await cli.monitor('gradle-app');

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/gradle/graph', 'puts at correct url');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'gradle-app',
        'build.gradle',
        {
          args: null,
          file: 'build.gradle',
          packageManager: 'gradle',
          path: 'gradle-app',
        },
      ],
      'calls gradle plugin',
    );
  });

  test('`monitor gradle-app --all-sub-projects`', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: {
            name: 'gradle',
          },
          package: {},
          meta: {
            versionBuildInfo: { java: '8', gradleVersion: '6.4' },
            gradleProjectName: 'original-name',
          },
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('gradle').returns(plugin);

    await cli.monitor('gradle-app', { allSubProjects: true });
    t.true(((spyPlugin.args[0] as any)[2] as any).allSubProjects);

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.deepEqual(
      req.body.meta.gradleProjectName,
      'original-name',
      'gradleProjectName passed',
    );
    t.deepEqual(
      req.body.meta.versionBuildInfo,
      '{"java":"8","gradleVersion":"6.4"}',
      'version build info passed',
    );
    t.match(req.url, '/monitor/gradle', 'puts at correct url');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'gradle-app',
        'build.gradle',
        {
          allSubProjects: true,
          args: null,
          file: 'build.gradle',
          packageManager: 'gradle',
          path: 'gradle-app',
        },
      ],
      'calls gradle plugin',
    );
  });

  test('`monitor gradle-app pip-app --all-sub-projects`', async (t) => {
    t.plan(9);
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: { name: 'gradle' },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('gradle').returns(plugin);
    loadPlugin.withArgs('pip').returns(plugin);

    await cli.monitor('gradle-app', 'pip-app', { allSubProjects: true });
    t.true(((spyPlugin.args[0] as any)[2] as any).allSubProjects);

    let req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request for pip');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/pip', 'puts at correct url');
    req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request for gradle');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/gradle', 'puts at correct url');

    t.same(
      spyPlugin.getCall(0).args,
      [
        'gradle-app',
        'build.gradle',
        {
          allSubProjects: true,
          args: null,
          file: 'build.gradle',
          packageManager: 'gradle',
          path: 'gradle-app',
        },
      ],
      'calls plugin for the 1st path',
    );
    t.same(
      spyPlugin.getCall(1).args,
      [
        'pip-app',
        'requirements.txt',
        {
          allSubProjects: true,
          args: null,
          file: 'requirements.txt',
          packageManager: 'pip',
          path: 'pip-app',
        },
      ],
      'calls plugin for the 2nd path',
    );
  });

  test('`monitor gradle-app --all-sub-projects --project-name`', async (t) => {
    t.plan(2);
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: { name: 'gradle' },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');
    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('gradle').returns(plugin);

    try {
      await cli.monitor('gradle-app', {
        allSubProjects: true,
        'project-name': 'frumpus',
      });
    } catch (e) {
      t.contains(e, /is currently not compatible/);
    }

    t.true(spyPlugin.notCalled, "`inspect` method wasn't called");
  });

  test('`monitor golang-gomodules --file=go.mod', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: {
            targetFile: 'go.mod',
            name: 'snyk-go-plugin',
            runtime: 'go',
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('gomodules').returns(plugin);

    await cli.monitor('golang-gomodules', {
      file: 'go.mod',
    });

    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/gomodules', 'puts at correct url');
    t.equal(req.body.targetFile, 'go.mod', 'sends the targetFile');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'golang-gomodules',
        'go.mod',
        {
          args: null,
          file: 'go.mod',
          packageManager: 'gomodules',
          path: 'golang-gomodules',
        },
      ],
      'calls golang plugin',
    );
  });

  test('`monitor golang-app --file=Gopkg.lock', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: {
            targetFile: 'Gopkg.lock',
            name: 'snyk-go-plugin',
            runtime: 'go',
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('golangdep').returns(plugin);

    await cli.monitor('golang-app', {
      file: 'Gopkg.lock',
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/golangdep', 'puts at correct url');
    t.equal(req.body.targetFile, 'Gopkg.lock', 'sends the targetFile');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'golang-app',
        'Gopkg.lock',
        {
          args: null,
          file: 'Gopkg.lock',
          packageManager: 'golangdep',
          path: 'golang-app',
        },
      ],
      'calls golang plugin',
    );
  });

  test('`monitor golang-app --file=vendor/vendor.json`', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          plugin: {
            targetFile: 'vendor/vendor.json',
            name: 'snyk-go-plugin',
            runtime: 'go',
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('govendor').returns(plugin);

    await cli.monitor('golang-app', {
      file: 'vendor/vendor.json',
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/govendor', 'puts at correct url');
    t.equal(req.body.targetFile, 'vendor/vendor.json', 'sends the targetFile');
    t.same(
      spyPlugin.getCall(0).args,
      [
        'golang-app',
        'vendor/vendor.json',
        {
          args: null,
          file: 'vendor/vendor.json',
          packageManager: 'govendor',
          path: 'golang-app',
        },
      ],
      'calls golang plugin',
    );
  });

  test('`monitor cocoapods-app (autodetect)`', async (t) => {
    chdirWorkspaces('cocoapods-app');
    const plugin = {
      async inspect() {
        return {
          plugin: {
            targetFile: 'Podfile',
            name: 'snyk-cocoapods-plugin',
            runtime: 'cocoapods',
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('cocoapods').returns(plugin);

    await cli.monitor('./');
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/cocoapods', 'puts at correct url');
    t.equal(req.body.targetFile, 'Podfile', 'sends the targetFile');
    t.same(
      spyPlugin.getCall(0).args,
      [
        './',
        'Podfile',
        {
          args: null,
          file: 'Podfile',
          packageManager: 'cocoapods',
          path: './',
        },
      ],
      'calls CocoaPods plugin',
    );
  });

  test('`monitor cocoapods-app --file=Podfile`', async (t) => {
    chdirWorkspaces('cocoapods-app');
    const plugin = {
      async inspect() {
        return {
          plugin: {
            targetFile: 'Podfile',
            name: 'snyk-cocoapods-plugin',
            runtime: 'cocoapods',
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('cocoapods').returns(plugin);

    await cli.monitor('./', {
      file: 'Podfile',
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/cocoapods', 'puts at correct url');
    t.equal(req.body.targetFile, 'Podfile', 'sends the targetFile (Podfile)');
    t.same(
      spyPlugin.getCall(0).args,
      [
        './',
        'Podfile',
        {
          args: null,
          file: 'Podfile',
          packageManager: 'cocoapods',
          path: './',
        },
      ],
      'calls CocoaPods plugin',
    );
  });

  test('`monitor large-mono-repo --file=bundler-app/Gemfile` suggest to use --all-projects', async (t) => {
    chdirWorkspaces('large-mono-repo');
    const res = await cli.monitor({ file: 'bundler-app/Gemfile' });
    t.match(res, '--all-projects', 'Suggest using --all-projects');
  });

  test('`monitor cocoapods-app --file=Podfile.lock`', async (t) => {
    chdirWorkspaces('cocoapods-app');
    const plugin = {
      async inspect() {
        return {
          plugin: {
            targetFile: 'Podfile',
            name: 'snyk-cocoapods-plugin',
            runtime: 'cocoapods',
          },
          package: {},
        };
      },
    };
    const spyPlugin = sinon.spy(plugin, 'inspect');

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('cocoapods').returns(plugin);

    await cli.monitor('./', {
      file: 'Podfile.lock',
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/cocoapods', 'puts at correct url');
    t.equal(req.body.targetFile, 'Podfile', 'sends the targetFile (Podfile)');
    t.same(
      spyPlugin.getCall(0).args,
      [
        './',
        'Podfile.lock',
        {
          args: null,
          file: 'Podfile.lock',
          packageManager: 'cocoapods',
          path: './',
        },
      ],
      'calls CocoaPods plugin',
    );
  });

  test('`monitor composer-app ruby-app` works on multiple params', async (t) => {
    chdirWorkspaces();
    let results = await cli.monitor('composer-app', 'ruby-app', { json: true });
    results = JSON.parse(results);
    // assert two proper responses
    t.equal(results.length, 2, '2 monitor results');

    // assert results contain monitor urls
    t.match(
      results[0].manageUrl,
      'http://localhost:12345/manage',
      'first monitor url is present',
    );
    t.match(
      results[1].manageUrl,
      'http://localhost:12345/manage',
      'second monitor url is present',
    );

    // assert results contain monitor urls
    t.match(results[0].path, 'composer', 'first monitor url is composer');
    t.match(results[1].path, 'ruby-app', 'second monitor url is ruby-app');

    // assert proper package managers detected
    t.match(results[0].packageManager, 'composer', 'composer package manager');
    t.match(results[1].packageManager, 'rubygems', 'rubygems package manager');
    t.end();
  });

  test('`monitor elixir-hex --file=mix.exs`', async (t) => {
    chdirWorkspaces();
    const plugin = {
      async inspect() {
        return {
          scannedProjects: [
            {
              packageManager: 'hex',
              targetFile: 'mix.exs',
              depGraph: await depGraphLib.createFromJSON({
                schemaVersion: '1.2.0',
                pkgManager: {
                  name: 'hex',
                },
                pkgs: [
                  {
                    id: 'snowflex@0.3.1',
                    info: {
                      name: 'snowflex',
                      version: '0.3.1',
                    },
                  },
                ],
                graph: {
                  rootNodeId: 'root-node',
                  nodes: [
                    {
                      nodeId: 'root-node',
                      pkgId: 'snowflex@0.3.1',
                      deps: [],
                    },
                  ],
                },
              }),
            },
          ],
          plugin: {
            name: 'testplugin',
            runtime: 'testruntime',
            targetFile: 'mix.exs',
          },
        };
      },
    };

    const loadPlugin = sinon.stub(plugins, 'loadPlugin');
    t.teardown(loadPlugin.restore);
    loadPlugin.withArgs('hex').returns(plugin);

    await cli.monitor('elixir-hex', { file: 'mix.exs' });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor/hex/graph', 'puts at correct url');
    t.equal(req.body.targetFile, 'mix.exs', 'sends targetFile');
    const depGraphJSON = req.body.depGraphJSON;
    t.ok(depGraphJSON);
  });

  test('`monitor foo:latest --docker`', async (t) => {
    const spyPlugin = stubDockerPluginResponse(
      {
        scanResults: [
          {
            identity: {
              type: 'rpm',
            },
            target: {
              image: 'docker-image|foo',
            },
            facts: [{ type: 'depGraph', data: {} }],
          },
        ],
      },
      t,
    );

    await cli.monitor('foo:latest', {
      docker: true,
      org: 'explicit-org',
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.deepEqual(
      req.body,
      {
        method: 'cli',
        scanResult: {
          identity: {
            type: 'rpm',
          },
          target: {
            image: 'docker-image|foo',
          },
          facts: [{ type: 'depGraph', data: {} }],
        },
        attributes: {},
      },
      'sends correct payload',
    );
    t.match(req.url, '/monitor-dependencies', 'puts at correct url');
    t.same(
      spyPlugin.getCall(0).args,
      [
        {
          docker: true,
          org: 'explicit-org',
          path: 'foo:latest',
        },
      ],
      'calls docker plugin with expected arguments',
    );
  });

  test('`monitor foo:latest --docker --file=Dockerfile`', async (t) => {
    const spyPlugin = stubDockerPluginResponse(
      {
        scanResults: [
          {
            identity: {
              type: 'rpm',
            },
            target: {
              image: 'docker-image|foo',
            },
            facts: [
              { type: 'depGraph', data: {} },
              { type: 'dockerfileAnalysis', data: {} },
            ],
          },
        ],
      },
      t,
    );

    await cli.monitor('foo:latest', {
      docker: true,
      org: 'explicit-org',
      file: 'Dockerfile',
    });
    const req = server.popRequest();
    t.equal(req.method, 'PUT', 'makes PUT request');
    t.equal(
      req.headers['x-snyk-cli-version'],
      versionNumber,
      'sends version number',
    );
    t.match(req.url, '/monitor-dependencies', 'puts at correct url');

    t.deepEqual(
      req.body,
      {
        method: 'cli',
        scanResult: {
          identity: {
            type: 'rpm',
          },
          target: {
            image: 'docker-image|foo',
          },
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'dockerfileAnalysis', data: {} },
          ],
        },
        attributes: {},
      },
      'sends correct payload',
    );
    t.same(
      spyPlugin.getCall(0).args,
      [
        {
          docker: true,
          file: 'Dockerfile',
          org: 'explicit-org',
          path: 'foo:latest',
        },
      ],
      'calls docker plugin with expected arguments',
    );
  });

  test('`monitor foo:latest --docker` doesnt send policy from cwd', async (t) => {
    chdirWorkspaces('npm-package-policy');
    stubDockerPluginResponse(
      {
        scanResults: [
          {
            identity: {
              type: 'rpm',
            },
            target: {
              image: 'docker-image|foo',
            },
            facts: [{ type: 'depGraph', data: {} }],
          },
        ],
      },
      t,
    );

    await cli.monitor('foo:latest', {
      docker: true,
      org: 'explicit-org',
    });
    const req = server.popRequest();
    t.deepEqual(req.body.scanResult.policy, undefined, 'no policy is sent');
  });

  test('`monitor foo:latest --docker` with custom policy path', async (t) => {
    chdirWorkspaces('npm-package-policy');
    const spyPlugin = stubDockerPluginResponse(
      {
        scanResults: [
          {
            identity: {
              type: 'rpm',
            },
            target: {
              image: 'docker-image|foo',
            },
            facts: [{ type: 'depGraph', data: {} }],
          },
        ],
        attributes: {},
      },
      t,
    );

    await cli.monitor('foo:latest', {
      docker: true,
      org: 'explicit-org',
      'policy-path': 'custom-location',
    });
    const req = server.popRequest();
    t.same(
      spyPlugin.getCall(0).args,
      [
        {
          docker: true,
          org: 'explicit-org',
          'policy-path': 'custom-location',
          path: 'foo:latest',
        },
      ],
      'calls docker plugin with expected arguments',
    );
    const expected = fs.readFileSync(
      path.join('custom-location', '.snyk'),
      'utf8',
    );
    const policyString = req.body.scanResult.policy;
    t.deepEqual(policyString, expected, 'sends correct policy');
  });

  test('`monitor foo:latest --docker --platform=linux/arm64`', async (t) => {
    const platform = 'linux/arm64';
    const spyPlugin = stubDockerPluginResponse(
      {
        scanResults: [
          {
            identity: {
              type: 'rpm',
              args: { platform },
            },
            target: {
              image: 'docker-image|foo',
            },
            facts: [{ type: 'depGraph', data: {} }],
          },
        ],
      },
      t,
    );

    await cli.monitor('foo:latest', {
      platform,
      docker: true,
    });
    const req = server.popRequest();
    t.deepEqual(
      req.body,
      {
        method: 'cli',
        scanResult: {
          identity: {
            type: 'rpm',
            args: { platform },
          },
          target: {
            image: 'docker-image|foo',
          },
          facts: [{ type: 'depGraph', data: {} }],
        },
        attributes: {},
      },
      'sends correct payload',
    );
    t.same(
      spyPlugin.getCall(0).args,
      [
        {
          docker: true,
          path: 'foo:latest',
          platform,
        },
      ],
      'calls docker plugin with expected arguments',
    );
  });

  test('`monitor foo:latest --docker --org=fake-org`', async (t) => {
    stubDockerPluginResponse(
      {
        scanResults: [
          {
            identity: {
              type: 'rpm',
            },
            target: {
              image: 'docker-image|foo',
            },
            facts: [{ type: 'depGraph', data: {} }],
          },
        ],
      },
      t,
    );

    await cli.monitor('foo:latest', {
      docker: true,
      org: 'fake-org',
    });
    const req = server.popRequest();
    t.deepEqual(
      req.query,
      {
        org: 'fake-org',
      },
      'sends correct payload',
    );
  });

  test('`monitor doesnotexist --docker`', async (t) => {
    try {
      await cli.monitor('doesnotexist', {
        docker: true,
        org: 'explicit-org',
      });
      t.fail('should have failed');
    } catch (err) {
      t.match(
        err.message,
        'Failed to scan image "doesnotexist". Please make sure the image and/or repository exist, and that you are using the correct credentials.',
        'show err message',
      );
      t.pass('throws err');
    }
  });

  test('monitor --json multiple folders', async (t) => {
    chdirWorkspaces('fail-on');

    const noFixableResult = getWorkspaceJSON(
      'fail-on',
      'no-fixable',
      'vulns-result.json',
    );
    server.setNextResponse(noFixableResult);
    try {
      const response = await cli.monitor('upgradable', 'no-fixable', {
        json: true,
      });
      const res = JSON.parse(response);
      if (isObject(res)) {
        t.pass('monitor outputted JSON');
      } else {
        t.fail('Failed parsing monitor JSON output');
      }
      const keyList = ['packageManager', 'manageUrl'];
      t.true(Array.isArray(res), 'Response is an array');
      t.equal(res.length, 2, 'Two monitor responses in the array');
      res.forEach((project) => {
        keyList.forEach((k) => {
          !get(project, k) ? t.fail(k + 'not found') : t.pass(k + ' found');
        });
      });
    } catch (error) {
      t.fail('should not have failed');
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
}
// fixture can be fixture path or object
function stubDockerPluginResponse(fixture: string | object, t) {
  const plugin = {
    async scan() {
      return typeof fixture === 'object' ? fixture : require(fixture);
    },
    async display() {
      return '';
    },
  };
  const spyPlugin = sinon.spy(plugin, 'scan');
  const loadPlugin = sinon.stub(ecosystemPlugins, 'getPlugin');
  loadPlugin.withArgs(sinon.match.any).returns(plugin);
  t.teardown(loadPlugin.restore);

  return spyPlugin;
}

/**
 * We can't expect all test environments to have Maven installed
 * So, hijack the system exec call and return the expected output
 */
function stubExec(t, execOutputFile) {
  const stub = sinon.stub(subProcess, 'execute').callsFake(() => {
    const stdout = fs.readFileSync(path.join(execOutputFile), 'utf8');
    return Promise.resolve(stdout);
  });
  t.teardown(() => {
    stub.restore();
  });
}
