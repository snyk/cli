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
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';

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

test('`test npm-package with custom --project-name`', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package', {
    'project-name': 'custom-project-name',
  });
  const req = server.popRequest();
  t.match(
    req.body.projectNameOverride,
    'custom-project-name',
    'custom project name is passed',
  );
  t.match(req.body.targetFile, undefined, 'target is undefined');
});

test('test npm-package remoteUrl', async (t) => {
  chdirWorkspaces();
  process.env.GIT_DIR = 'npm-package/gitdir';
  await cli.test('npm-package');
  const req = server.popRequest();
  t.equal(
    req.body.target.remoteUrl,
    'http://github.com/snyk/npm-package',
    'git remoteUrl is passed',
  );
  t.equals(
    req.body.target.branch,
    'master',
    'correct branch passed to request',
  );

  delete process.env.GIT_DIR;
});

test('test npm-package remoteUrl with --remote-repo-url', async (t) => {
  chdirWorkspaces();
  process.env.GIT_DIR = 'npm-package/gitdir';
  await cli.test('npm-package', {
    'remote-repo-url': 'foo',
  });
  const req = server.popRequest();
  t.equal(req.body.target.remoteUrl, 'foo', 'specified remoteUrl is passed');
  t.equals(
    req.body.target.branch,
    'master',
    'correct branch passed to request',
  );

  delete process.env.GIT_DIR;
});

test('`test --file=fixtures/protect/package.json`', async (t) => {
  const res = await cli.test(path.resolve(__dirname, '..'), {
    file: 'fixtures/protect/package.json',
  });
  t.match(
    res,
    /Tested 1 dependencies for known vulnerabilities/,
    'should succeed in a folder',
  );
});

test('`test npm-package-policy` returns correct meta', async (t) => {
  chdirWorkspaces();
  const res = await cli.test('npm-package-policy');
  const meta = res.slice(res.indexOf('Organization:')).split('\n');
  t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
  t.match(meta[1], /Package manager:\s+npm/, 'package manager displayed');
  t.match(meta[2], /Target file:\s+package.json/, 'target file displayed');
  t.match(
    meta[3],
    /Project name:\s+custom-policy-location-package/,
    'project name displayed',
  );
  t.match(meta[4], /Open source:\s+no/, 'open source displayed');
  t.match(meta[5], /Project path:\s+npm-package-policy/, 'path displayed');
  t.match(meta[6], /Local Snyk policy:\s+found/, 'local policy displayed');
});

test('`test npm-package` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package');
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.match(req.body.targetFile, undefined, 'target is undefined');
  const depGraph = req.body.depGraph;

  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['npm-package@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
    'depGraph looks fine',
  );
});

test('`test npm-package --file=package-lock.json ` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package', { file: 'package-lock.json' });
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.match(req.body.targetFile, undefined, 'target is undefined');
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['npm-package@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
    'depGraph looks fine',
  );
});

test('`test npm-package --file=package-lock.json --dev` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package', { file: 'package-lock.json', dev: true });
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.match(req.body.targetFile, undefined, 'target is undefined');
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    [
      'npm-package@1.0.0',
      'ms@0.7.1',
      'debug@2.2.0',
      'object-assign@4.1.1',
    ].sort(),
    'depGraph looks fine',
  );
});

test('`test npm-out-of-sync` out of sync fails', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('npm-out-of-sync', { dev: true });
    t.fail('Should fail');
  } catch (e) {
    t.equal(
      e.message,
      '\nTesting npm-out-of-sync...\n\n' +
      'Dependency snyk was not found in package-lock.json.' +
      ' Your package.json and package-lock.json are probably out of sync.' +
      ' Please run "npm install" and try again.',
      'Contains enough info about err',
    );
  }
});

test('`test npm-out-of-sync --strict-out-of-sync=false` passes', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-out-of-sync', { dev: true, strictOutOfSync: false });
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    [
      'npm-package@1.0.0',
      'object-assign@4.1.1',
      'rewire@^4.0.1',
      'snyk@*',
      'to-array@0.1.4',
    ].sort(),
    'depGraph looks fine',
  );
});

test('`test npm-package-shrinkwrap --file=package-lock.json ` with npm-shrinkwrap errors', async (t) => {
  t.plan(1);
  chdirWorkspaces();
  try {
    await cli.test('npm-package-shrinkwrap', { file: 'package-lock.json' });
    t.fail('Should fail');
  } catch (e) {
    t.includes(
      e.message,
      '--file=package-lock.json',
      'Contains enough info about err',
    );
  }
});

test('`test npm-package-with-subfolder --file=package-lock.json ` picks top-level files', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package-with-subfolder', { file: 'package-lock.json' });
  const req = server.popRequest();
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['npm-package-top-level@1.0.0', 'to-array@0.1.4'].sort(),
    'depGraph looks fine',
  );
});

test('`test npm-package-with-subfolder --file=subfolder/package-lock.json ` picks subfolder files', async (t) => {
  chdirWorkspaces();
  await cli.test('npm-package-with-subfolder', {
    file: 'subfolder/package-lock.json',
  });
  const req = server.popRequest();
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['npm-package-subfolder@1.0.0', 'to-array@0.1.4'].sort(),
    'depGraph looks fine',
  );
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
