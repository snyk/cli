import * as tap from 'tap';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as needle from 'needle';
import * as cli from '../../../src/cli/commands';
import { fakeServer } from '../fake-server';
import * as subProcess from '../../../src/lib/sub-process';
import * as version from '../../../src/lib/version';
import * as userConfig from '../../../src/lib/user-config';

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as snykPolicy from 'snyk-policy';
import { AllProjectsTests } from './cli-monitor.all-projects.spec';

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

test('`monitor npm-package with experimental-dep-graph enabled, but bad auth token`', async (t) => {
  chdirWorkspaces();

  const validTokenStub = sinon
    .stub(needle, 'request')
    .yields(null, null, { code: 401, error: 'Invalid auth token provided' });

  try {
    await cli.monitor('npm-package', { 'experimental-dep-graph': true });
    t.fail('should have thrown an error');
  } catch (e) {
    t.equal(e.name, 'Error', 'correct error was thrown');
    t.match(
      e.message,
      'Invalid auth token provided',
      'correct default error message',
    );

    validTokenStub.restore();
  }
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
  t.notOk(req.body.meta.prePruneDepCount, "doesn't send meta.prePruneDepCount");
});

test('`monitor npm-package with --all-projects has not effect`', async (t) => {
  // TODO: monitor --all-projects is not supported initially
  chdirWorkspaces();
  await cli.monitor('npm-package', {
    'all-projects': true,
  });
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
  t.notOk(req.body.meta.prePruneDepCount, "doesn't send meta.prePruneDepCount");
});

test('`monitor npm-out-of-sync graph monitor`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('npm-out-of-sync-graph', {
    'experimental-dep-graph': true,
    strictOutOfSync: false,
  });
  const req = server.popRequest();
  t.match(req.url, '/monitor/npm/graph', 'puts at correct url');
  t.ok(req.body.depGraphJSON, 'sends depGraphJSON');
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

test('`monitor npm-package-pruneable --prune-repeated-subdependencies`', async (t) => {
  chdirWorkspaces();

  await cli.monitor('npm-package-pruneable', {
    'prune-repeated-subdependencies': true,
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
  const packageC = depGraphJSON.graph.nodes.find(
    (pkg) => pkg.pkgId === 'c@1.0.0',
  );
  t.ok(packageC.info.labels.pruned, 'a.d.c is pruned');
  t.notOk(packageC.dependencies, 'a.d.c has no dependencies');
});

test('`monitor npm-package-pruneable --prune-repeated-subdependencies --experimental-dep-graph`', async (t) => {
  chdirWorkspaces();

  await cli.monitor('npm-package-pruneable', {
    'prune-repeated-subdependencies': true,
    'experimental-dep-graph': true,
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/npm/graph', 'puts at correct url');
  t.ok(req.body.depGraphJSON, 'sends depGraphJSON');
});

test('`monitor npm-package-pruneable --experimental-dep-graph`', async (t) => {
  chdirWorkspaces();

  await cli.monitor('npm-package-pruneable', {
    'experimental-dep-graph': true,
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/npm/graph', 'puts at correct url');
  t.ok(req.body.depGraphJSON, 'sends depGraphJSON');
});

test('`monitor npm-package-pruneable experimental for no-flag org`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('npm-package-pruneable', {
    org: 'no-flag',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/npm', 'puts at correct url');
  t.deepEqual(req.body.meta.monitorGraph, false, 'correct meta set');
  t.ok(req.body.package, 'sends package');
  userConfig.delete('org');
});

test('`monitor sbt package --experimental-dep-graph --sbt-graph`', async (t) => {
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

  await cli.monitor('sbt-simple-struts', {
    'experimental-dep-graph': true,
    'sbt-graph': true,
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.match(req.url, '/monitor/sbt/graph', 'puts at correct url');
  t.ok(req.body.depGraphJSON, 'sends depGraphJSON');
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
  t.match(req.url, '/monitor/rubygems', 'puts at correct url');
  t.notOk(req.body.targetFile, 'doesnt send the targetFile');
  t.ok(req.body.package.dependencies, 'dependencies sent instead of files');
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

test('`test maven-app-with-jars --scan-all-unmanaged` sends package info', async (t) => {
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

test('`monitor gradle-app --all-sub-projects`', async (t) => {
  t.plan(5);
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

  await cli.monitor('gradle-app', { allSubProjects: true });
  t.true(((spyPlugin.args[0] as any)[2] as any).allSubProjects);

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

test('`monitor foo:latest --docker`', async (t) => {
  const dockerImageId =
    'sha256:' +
    '578c3e61a98cb5720e7c8fc152017be1dff373ebd72a32bbe6e328234efc8d1a';
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'rpm',
        dockerImageId,
      },
      package: {},
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
  t.match(
    req.url,
    '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)',
  );
  t.equal(req.body.meta.dockerImageId, dockerImageId, 'sends dockerImageId');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        docker: true,
        file: null,
        org: 'explicit-org',
        packageManager: null,
        path: 'foo:latest',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`monitor foo:latest --docker --file=Dockerfile`', async (t) => {
  const dockerImageId =
    'sha256:' +
    '578c3e61a98cb5720e7c8fc152017be1dff373ebd72a32bbe6e328234efc8d1a';
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'rpm',
        dockerImageId,
      },
      package: { docker: 'base-image-name' },
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
  t.match(
    req.url,
    '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)',
  );
  t.equal(req.body.meta.dockerImageId, dockerImageId, 'sends dockerImageId');
  t.equal(req.body.package.docker, 'base-image-name', 'sends base image');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      'Dockerfile',
      {
        args: null,
        docker: true,
        file: 'Dockerfile',
        org: 'explicit-org',
        packageManager: null,
        path: 'foo:latest',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`monitor foo:latest --docker` doesnt send policy from cwd', async (t) => {
  chdirWorkspaces('npm-package-policy');
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'rpm',
      },
      package: {},
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
  t.match(
    req.url,
    '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)',
  );
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        docker: true,
        file: null,
        org: 'explicit-org',
        packageManager: null,
        path: 'foo:latest',
      },
    ],
    'calls docker plugin with expected arguments',
  );

  const emptyPolicy = await snykPolicy.create();
  t.deepEqual(req.body.policy, emptyPolicy.toString(), 'empty policy is sent');
});

test('`monitor foo:latest --docker` with custom policy path', async (t) => {
  chdirWorkspaces('npm-package-policy');
  const plugin = {
    async inspect() {
      return {
        plugin: {
          packageManager: 'rpm',
          name: 'docker',
        },
        package: {},
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin
    .withArgs(sinon.match.any, sinon.match({ docker: true }))
    .returns(plugin);
  t.teardown(loadPlugin.restore);

  await cli.monitor('foo:latest', {
    docker: true,
    org: 'explicit-org',
    'policy-path': 'custom-location',
  });
  const req = server.popRequest();
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(
    req.url,
    '/monitor/rpm',
    'puts at correct url (uses package manager from plugin response)',
  );
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        docker: true,
        file: null,
        org: 'explicit-org',
        'policy-path': 'custom-location',
        packageManager: null,
        path: 'foo:latest',
      },
    ],
    'calls docker plugin with expected arguments',
  );
  const expected = fs.readFileSync(
    path.join('custom-location', '.snyk'),
    'utf8',
  );
  const policyString = req.body.policy;
  t.deepEqual(policyString, expected, 'sends correct policy');
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
