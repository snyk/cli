import * as tap from 'tap';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as depGraphLib from '@snyk/dep-graph';
import * as _ from 'lodash';
import * as needle from 'needle';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as subProcess from '../../src/lib/sub-process';
import * as version from '../../src/lib/version';

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as snykPolicy from 'snyk-policy';

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

function loadJson(filename: string) {
  return JSON.parse(fs.readFileSync(filename, 'utf-8'));
}

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

test('test cli with multiple params: good and bad', async (t) => {
  try {
    await cli.test('/', 'semver', { registry: 'npm', org: 'EFF', json: true });
    t.fail('expect to err');
  } catch (err) {
    const errObj = JSON.parse(err.message);
    t.ok(errObj.length === 2, 'expecting two results');
    t.notOk(errObj[0].ok, 'first object shouldnt be ok');
    t.ok(errObj[1].ok, 'second object should be ok');
    t.ok(errObj[0].path.length > 0, 'should have path');
    t.ok(errObj[1].path.length > 0, 'should have path');
    t.pass('info on both objects');
  }
  t.end();
});

test('userMessage correctly bubbles with npm', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('npm-package', { org: 'missing-org' });
    t.fail('expect to err');
  } catch (err) {
    t.equal(err.userMessage, 'cli error message', 'got correct err message');
  }
  t.end();
});

test('userMessage correctly bubbles with everything other than npm', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('ruby-app', { org: 'missing-org' });
    t.fail('expect to err');
  } catch (err) {
    t.equal(err.userMessage, 'cli error message', 'got correct err message');
  }
  t.end();
});

/**
 * Remote package `test`
 */

test('`test semver` sends remote NPM request:', async (t) => {
  // We care about the request here, not the response
  const output = await cli.test('semver', { registry: 'npm', org: 'EFF' });
  const req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/vuln/npm/semver', 'gets from correct url');
  t.equal(req.query.org, 'EFF', 'org sent as a query in request');
  t.match(output, 'Testing semver', 'has "Testing semver" message');
  t.notMatch(output, 'Remediation', 'shows no remediation advice');
  t.notMatch(output, 'snyk wizard', 'does not suggest `snyk wizard`');
});

test('`test sinatra --registry=rubygems` sends remote Rubygems request:', async (t) => {
  await cli.test('sinatra', { registry: 'rubygems', org: 'ACME' });
  const req = server.popRequest();
  t.equal(req.method, 'GET', 'makes GET request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/vuln/rubygems/sinatra', 'gets from correct url');
  t.equal(req.query.org, 'ACME', 'org sent as a query in request');
});

/**
 * Local source `test`
 */

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

test('`test empty --file=Gemfile`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('empty', { file: 'Gemfile' });
    t.fail('should have failed');
  } catch (err) {
    t.pass('throws err');
    t.match(
      err.message,
      'Could not find the specified file: Gemfile',
      'shows err',
    );
  }
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

test('`test /` test for non-existent with path specified', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('/');
    t.fail('should have failed');
  } catch (err) {
    t.pass('throws err');
    t.match(
      err.message,
      'Could not detect supported target files in /.' +
        '\nPlease see our documentation for supported' +
        ' languages and target files: ' +
        'https://support.snyk.io/hc/en-us/articles/360000911957-Language-support' +
        ' and make sure you' +
        ' are in the right directory.',
    );
  }
});

test('`test nuget-app --file=non_existent`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('nuget-app', { file: 'non-existent' });
    t.fail('should have failed');
  } catch (err) {
    t.pass('throws err');
    t.match(
      err.message,
      'Could not find the specified file: non-existent',
      'show first part of err message',
    );
    t.match(
      err.message,
      'Please check that it exists and try again.',
      'show second part of err message',
    );
  }
});

test('`test empty --file=readme.md`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('empty', { file: 'readme.md' });
    t.fail('should have failed');
  } catch (err) {
    t.pass('throws err');
    t.match(
      err.message,
      'Could not detect package manager for file: readme.md',
      'shows err message for when file specified exists, but not supported',
    );
  }
});

test('`test ruby-app-no-lockfile --file=Gemfile`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('ruby-app-no-lockfile', { file: 'Gemfile' });
    t.fail('should have failed');
  } catch (err) {
    t.pass('throws err');
    t.match(err.message, 'Please run `bundle install`', 'shows err');
  }
});

test('`test ruby-app --file=Gemfile.lock`', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-app', { file: 'Gemfile.lock' });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['ruby-app@', 'json@2.0.2', 'lynx@0.4.0'].sort(),
    'depGraph looks fine',
  );
});

test('`test ruby-app` meta when no vulns', async (t) => {
  chdirWorkspaces();
  const res = await cli.test('ruby-app');

  const meta = res.slice(res.indexOf('Organization:')).split('\n');
  t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
  t.match(meta[1], /Package manager:\s+rubygems/, 'package manager displayed');
  t.match(meta[2], /Target file:\s+Gemfile/, 'target file displayed');
  t.match(meta[3], /Project name:\s+ruby-app/, 'project name displayed');
  t.match(meta[4], /Open source:\s+no/, 'open source displayed');
  t.match(meta[5], /Project path:\s+ruby-app/, 'path displayed');
  t.notMatch(
    meta[5],
    /Local Snyk policy:\s+found/,
    'local policy not displayed',
  );
});

test('`test ruby-app-thresholds`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result.json'),
  );

  try {
    await cli.test('ruby-app-thresholds');
    t.fail('should have thrown');
  } catch (err) {
    const res = err.message;

    t.match(
      res,
      'Tested 7 dependencies for known vulnerabilities, found 6 vulnerabilities, 7 vulnerable paths',
      '6 vulns',
    );

    const meta = res.slice(res.indexOf('Organization:')).split('\n');
    t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
    t.match(
      meta[1],
      /Package manager:\s+rubygems/,
      'package manager displayed',
    );
    t.match(meta[2], /Target file:\s+Gemfile/, 'target file displayed');
    t.match(
      meta[3],
      /Project name:\s+ruby-app-thresholds/,
      'project name displayed',
    );
    t.match(meta[4], /Open source:\s+no/, 'open source displayed');
    t.match(meta[5], /Project path:\s+ruby-app-thresholds/, 'path displayed');
    t.notMatch(
      meta[5],
      /Local Snyk policy:\s+found/,
      'local policy not displayed',
    );
  }
});

test('`test ruby-app-thresholds --severity-threshold=low --json`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-low-severity.json'),
  );

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'low',
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'low');

    const res = JSON.parse(err.message);

    const expected = require('./workspaces/ruby-app-thresholds/legacy-res-json-low-severity.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok',
    );
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same',
    );
  }
});

test('`test ruby-app-thresholds --severity-threshold=medium`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-medium-severity.json'),
  );

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'medium',
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'medium');

    const res = err.message;

    t.match(
      res,
      'Tested 7 dependencies for known vulnerabilities, found 5 vulnerabilities, 6 vulnerable paths',
      '5 vulns',
    );
  }
});

test('`test ruby-app-thresholds --ignore-policy`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-medium-severity.json'),
  );

  try {
    await cli.test('ruby-app-thresholds', {
      'ignore-policy': true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.equal(req.query.ignorePolicy, 'true');
    t.end();
  }
});

test('`test ruby-app-thresholds --severity-threshold=medium --json`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-medium-severity.json'),
  );

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'medium',
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'medium');

    const res = JSON.parse(err.message);

    const expected = require('./workspaces/ruby-app-thresholds/legacy-res-json-medium-severity.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok',
    );
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same',
    );
  }
});

test('`test ruby-app-thresholds --severity-threshold=high', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-high-severity.json'),
  );

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'high',
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'high');

    const res = err.message;

    t.match(
      res,
      'Tested 7 dependencies for known vulnerabilities, found 3 vulnerabilities, 4 vulnerable paths',
      '3 vulns',
    );
  }
});

test('`test ruby-app-thresholds --severity-threshold=high --json`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-thresholds/test-graph-result-high-severity.json'),
  );

  try {
    await cli.test('ruby-app-thresholds', {
      severityThreshold: 'high',
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const req = server.popRequest();
    t.is(req.query.severityThreshold, 'high');

    const res = JSON.parse(err.message);

    const expected = require('./workspaces/ruby-app-thresholds/legacy-res-json-high-severity.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok',
    );
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same',
    );
  }
});

test('`test ruby-app-policy`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-policy/test-graph-result.json'),
  );

  try {
    await cli.test('ruby-app-policy', {
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const res = JSON.parse(err.message);

    const expected = require('./workspaces/ruby-app-policy/legacy-res-json.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok',
    );
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same',
    );
  }
});

test('`test ruby-app-policy` with cloud ignores', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-policy/test-graph-result-cloud-ignore.json'),
  );

  try {
    await cli.test('ruby-app-policy', {
      json: true,
    });
    t.fail('should have thrown');
  } catch (err) {
    const res = JSON.parse(err.message);

    const expected = require('./workspaces/ruby-app-policy/legacy-res-json-cloud-ignore.json');

    t.deepEqual(
      _.omit(res, ['vulnerabilities']),
      _.omit(expected, ['vulnerabilities']),
      'metadata is ok',
    );
    t.deepEqual(
      _.sortBy(res.vulnerabilities, 'id'),
      _.sortBy(expected.vulnerabilities, 'id'),
      'vulns are the same',
    );
  }
});

test('`test ruby-app-no-vulns`', async (t) => {
  chdirWorkspaces();

  server.setNextResponse(
    require('./workspaces/ruby-app-no-vulns/test-graph-result.json'),
  );

  const outText = await cli.test('ruby-app-no-vulns', {
    json: true,
  });

  const res = JSON.parse(outText);

  const expected = require('./workspaces/ruby-app-no-vulns/legacy-res-json.json');

  t.deepEqual(res, expected, '--json output is the same');
});

test('`test ruby-app-no-vulns`', async (t) => {
  chdirWorkspaces();

  const apiResponse = Object.assign(
    {},
    require('./workspaces/ruby-app-no-vulns/test-graph-result.json'),
  );
  apiResponse.meta.isPublic = true;
  server.setNextResponse(apiResponse);

  const outText = await cli.test('ruby-app-no-vulns', {
    json: true,
  });

  const res = JSON.parse(outText);

  const expected = Object.assign(
    {},
    require('./workspaces/ruby-app-no-vulns/legacy-res-json.json'),
    { isPrivate: false },
  );

  t.deepEqual(res, expected, '--json output is the same');
});

test('`test gradle-kotlin-dsl-app` returns correct meta', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  const res = await cli.test('gradle-kotlin-dsl-app');
  const meta = res.slice(res.indexOf('Organization:')).split('\n');
  t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
  t.match(meta[1], /Package manager:\s+gradle/, 'package manager displayed');
  t.match(meta[2], /Target file:\s+build.gradle.kts/, 'target file displayed');
  t.match(meta[3], /Open source:\s+no/, 'open source displayed');
  t.match(meta[4], /Project path:\s+gradle-kotlin-dsl-app/, 'path displayed');
  t.notMatch(
    meta[5],
    /Local Snyk policy:\s+found/,
    'local policy not displayed',
  );
});

test('`test gradle-app` returns correct meta', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  const res = await cli.test('gradle-app');
  const meta = res.slice(res.indexOf('Organization:')).split('\n');

  t.false(
    ((spyPlugin.args[0] as any)[2] as any).allSubProjects,
    '`allSubProjects` option is not sent',
  );
  t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
  t.match(meta[1], /Package manager:\s+gradle/, 'package manager displayed');
  t.match(meta[2], /Target file:\s+build.gradle/, 'target file displayed');
  t.match(meta[3], /Open source:\s+no/, 'open source displayed');
  t.match(meta[4], /Project path:\s+gradle-app/, 'path displayed');
  t.notMatch(
    meta[5],
    /Local Snyk policy:\s+found/,
    'local policy not displayed',
  );
});

test('`test gradle-app --all-sub-projects` sends `allSubProjects` argument to plugin', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return { plugin: { name: 'gradle' }, package: {} };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  await cli.test('gradle-app', {
    allSubProjects: true,
  });
  t.true(((spyPlugin.args[0] as any)[2] as any).allSubProjects);
});

test('`test gradle-app` plugin fails to return package or scannedProjects', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return { plugin: { name: 'gradle' } };
    },
  };
  sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  try {
    await cli.test('gradle-app', {});
    t.fail('expected error');
  } catch (error) {
    t.match(
      error,
      /error getting dependencies from gradle plugin: neither 'package' nor 'scannedProjects' were found/,
      'error found',
    );
  }
});

test('`test gradle-app --all-sub-projects` returns correct multi tree meta', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect(): Promise<pluginApi.MultiProjectResult> {
      return {
        plugin: { name: 'gradle' },
        scannedProjects: [
          {
            depTree: {
              name: 'tree0',
              version: '1.0.0',
              dependencies: { dep1: { name: 'dep1', version: '1' } },
            },
          },
          {
            depTree: {
              name: 'tree1',
              version: '2.0.0',
              dependencies: { dep1: { name: 'dep2', version: '2' } },
            },
          },
        ],
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gradle').returns(plugin);

  const res = await cli.test('gradle-app', { allSubProjects: true });
  t.true(
    ((spyPlugin.args[0] as any)[2] as any).allSubProjects,
    '`allSubProjects` option is sent',
  );

  const tests = res.split('Testing gradle-app...').filter((s) => !!s.trim());
  t.equals(tests.length, 2, 'two projects tested independently');
  t.match(
    res,
    /Tested 2 projects/,
    'number projects tested displayed properly',
  );
  for (let i = 0; i < tests.length; i++) {
    const meta = tests[i].slice(tests[i].indexOf('Organization:')).split('\n');
    t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
    t.match(meta[1], /Package manager:\s+gradle/, 'package manager displayed');
    t.match(meta[2], /Target file:\s+build.gradle/, 'target file displayed');
    t.match(meta[3], /Project name:\s+tree/, 'sub-project displayed');
    t.includes(meta[3], `tree${i}`, 'sub-project displayed');
    t.match(meta[4], /Open source:\s+no/, 'open source displayed');
    t.match(meta[5], /Project path:\s+gradle-app/, 'path displayed');
    t.notMatch(
      meta[6],
      /Local Snyk policy:\s+found/,
      'local policy not displayed',
    );
  }
});

test('`test` returns correct meta when target file specified', async (t) => {
  chdirWorkspaces();
  const res = await cli.test('ruby-app', { file: 'Gemfile.lock' });
  const meta = res.slice(res.indexOf('Organization:')).split('\n');
  t.match(meta[2], /Target file:\s+Gemfile.lock/, 'target file displayed');
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

test('`test ruby-gem-no-lockfile --file=ruby-gem.gemspec`', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-gem-no-lockfile', { file: 'ruby-gem.gemspec' });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id),
    ['ruby-gem-no-lockfile@'],
    'no deps as we dont really support gemspecs yet',
  );
});

test('`test ruby-gem --file=ruby-gem.gemspec`', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-gem', { file: 'ruby-gem.gemspec' });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['ruby-gem@', 'ruby-gem@0.1.0', 'rake@10.5.0'].sort(),
    'depGraph looks fine',
  );
});

test('`test ruby-app` auto-detects Gemfile', async (t) => {
  chdirWorkspaces();
  await cli.test('ruby-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['ruby-app@', 'json@2.0.2', 'lynx@0.4.0'].sort(),
    'depGraph looks fine',
  );
  t.equal(req.body.targetFile, 'Gemfile', 'specifies target');
});

test('`test nuget-app-2 auto-detects project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'project.assets.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app-2');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app-2',
      'project.assets.json',
      {
        args: null,
        file: 'project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app-2',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app-2.1 auto-detects obj/project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'obj/project.assets.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app-2.1');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app-2.1',
      'obj/project.assets.json',
      {
        args: null,
        file: 'obj/project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app-2.1',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app-4 auto-detects packages.config`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app-4');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app-4',
      'packages.config',
      {
        args: null,
        file: 'packages.config',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app-4',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test paket-app auto-detects paket.dependencies`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('paket').returns(plugin);

  await cli.test('paket-app');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'paket');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'paket-app',
      'paket.dependencies',
      {
        args: null,
        file: 'paket.dependencies',
        org: null,
        projectName: null,
        packageManager: 'paket',
        path: 'paket-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test paket-obj-app auto-detects obj/project.assets.json if exists`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('paket-obj-app');

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'paket-obj-app',
      'obj/project.assets.json',
      {
        args: null,
        file: 'obj/project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'paket-obj-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test monorepo --file=sub-ruby-app/Gemfile`', async (t) => {
  chdirWorkspaces();
  await cli.test('monorepo', { file: 'sub-ruby-app/Gemfile' });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');

  const depGraph = req.body.depGraph;
  t.equal(depGraph.pkgManager.name, 'rubygems');
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['monorepo@', 'json@2.0.2', 'lynx@0.4.0'].sort(),
    'depGraph looks fine',
  );

  t.equal(
    req.body.targetFile,
    path.join('sub-ruby-app', 'Gemfile'),
    'specifies target',
  );
});

test('`test maven-app --file=pom.xml --dev` sends package info', async (t) => {
  chdirWorkspaces();
  stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
  await cli.test('maven-app', {
    file: 'pom.xml',
    org: 'nobelprize.org',
    dev: true,
  });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.query.org, 'nobelprize.org', 'org sent as a query in request');
  t.match(req.body.targetFile, undefined, 'target is undefined');

  const depGraph = depGraphLib.createFromJSON(req.body.depGraph);
  t.equal(depGraph.rootPkg.name, 'com.mycompany.app:maven-app', 'root name');
  const pkgs = depGraph.getPkgs().map((x) => `${x.name}@${x.version}`);
  t.ok(pkgs.indexOf('com.mycompany.app:maven-app@1.0-SNAPSHOT') >= 0);
  t.ok(pkgs.indexOf('axis:axis@1.4') >= 0);
  t.ok(pkgs.indexOf('junit:junit@3.8.2') >= 0);
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

// yarn lockfile based testing is only supported for node 4+
test('`test yarn-out-of-sync` out of sync fails', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('yarn-out-of-sync', { dev: true });
    t.fail('Should fail');
  } catch (e) {
    t.equal(
      e.message,
      '\nTesting yarn-out-of-sync...\n\n' +
        'Dependency snyk was not found in yarn.lock.' +
        ' Your package.json and yarn.lock are probably out of sync.' +
        ' Please run "yarn install" and try again.',
      'Contains enough info about err',
    );
  }
});

test('`test yarn-out-of-sync --strict-out-of-sync=false` passes', async (t) => {
  chdirWorkspaces();
  await cli.test('yarn-out-of-sync', { dev: true, strictOutOfSync: false });
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    [
      'acorn-jsx@3.0.1',
      'acorn@3.3.0',
      'acorn@5.7.3',
      'ajv-keywords@2.1.1',
      'ajv@5.5.2',
      'ansi-escapes@3.1.0',
      'ansi-regex@2.1.1',
      'ansi-regex@3.0.0',
      'ansi-styles@2.2.1',
      'ansi-styles@3.2.1',
      'argparse@1.0.10',
      'array-union@1.0.2',
      'array-uniq@1.0.3',
      'arrify@1.0.1',
      'babel-code-frame@6.26.0',
      'balanced-match@1.0.0',
      'brace-expansion@1.1.11',
      'buffer-from@1.1.1',
      'caller-path@0.1.0',
      'callsites@0.2.0',
      'chalk@1.1.3',
      'chalk@2.4.1',
      'chardet@0.4.2',
      'circular-json@0.3.3',
      'cli-cursor@2.1.0',
      'cli-width@2.2.0',
      'co@4.6.0',
      'color-convert@1.9.3',
      'color-name@1.1.3',
      'concat-map@0.0.1',
      'concat-stream@1.6.2',
      'core-util-is@1.0.2',
      'cross-spawn@5.1.0',
      'debug@3.2.5',
      'deep-is@0.1.3',
      'del@2.2.2',
      'doctrine@2.1.0',
      'escape-string-regexp@1.0.5',
      'eslint-scope@3.7.3',
      'eslint-visitor-keys@1.0.0',
      'eslint@4.19.1',
      'espree@3.5.4',
      'esprima@4.0.1',
      'esquery@1.0.1',
      'esrecurse@4.2.1',
      'estraverse@4.2.0',
      'esutils@2.0.2',
      'external-editor@2.2.0',
      'fast-deep-equal@1.1.0',
      'fast-json-stable-stringify@2.0.0',
      'fast-levenshtein@2.0.6',
      'figures@2.0.0',
      'file-entry-cache@2.0.0',
      'flat-cache@1.3.0',
      'fs.realpath@1.0.0',
      'functional-red-black-tree@1.0.1',
      'glob@7.1.3',
      'globals@11.7.0',
      'globby@5.0.0',
      'graceful-fs@4.1.11',
      'has-ansi@2.0.0',
      'has-flag@3.0.0',
      'iconv-lite@0.4.24',
      'ignore@3.3.10',
      'imurmurhash@0.1.4',
      'inflight@1.0.6',
      'inherits@2.0.3',
      'inquirer@3.3.0',
      'is-fullwidth-code-point@2.0.0',
      'is-path-cwd@1.0.0',
      'is-path-in-cwd@1.0.1',
      'is-path-inside@1.0.1',
      'is-promise@2.1.0',
      'is-resolvable@1.1.0',
      'isarray@1.0.0',
      'isexe@2.0.0',
      'js-tokens@3.0.2',
      'js-yaml@3.12.0',
      'json-schema-traverse@0.3.1',
      'json-stable-stringify-without-jsonify@1.0.1',
      'levn@0.3.0',
      'lodash@4.17.11',
      'lru-cache@4.1.3',
      'mimic-fn@1.2.0',
      'minimatch@3.0.4',
      'minimist@0.0.8',
      'mkdirp@0.5.1',
      'ms@2.1.1',
      'mute-stream@0.0.7',
      'natural-compare@1.4.0',
      'npm-package@1.0.0',
      'object-assign@4.1.1',
      'once@1.4.0',
      'onetime@2.0.1',
      'optionator@0.8.2',
      'os-tmpdir@1.0.2',
      'path-is-absolute@1.0.1',
      'path-is-inside@1.0.2',
      'pify@2.3.0',
      'pinkie-promise@2.0.1',
      'pinkie@2.0.4',
      'pluralize@7.0.0',
      'prelude-ls@1.1.2',
      'process-nextick-args@2.0.0',
      'progress@2.0.0',
      'pseudomap@1.0.2',
      'readable-stream@2.3.6',
      'regexpp@1.1.0',
      'require-uncached@1.0.3',
      'resolve-from@1.0.1',
      'restore-cursor@2.0.0',
      'rewire@4.0.1',
      'rimraf@2.6.2',
      'run-async@2.3.0',
      'rx-lite-aggregates@4.0.8',
      'rx-lite@4.0.8',
      'safe-buffer@5.1.2',
      'safer-buffer@2.1.2',
      'semver@5.5.1',
      'shebang-command@1.2.0',
      'shebang-regex@1.0.0',
      'signal-exit@3.0.2',
      'slice-ansi@1.0.0',
      'snyk@*',
      'sprintf-js@1.0.3',
      'string-width@2.1.1',
      'string_decoder@1.1.1',
      'strip-ansi@3.0.1',
      'strip-ansi@4.0.0',
      'strip-json-comments@2.0.1',
      'supports-color@2.0.0',
      'supports-color@5.5.0',
      'table@4.0.2',
      'text-table@0.2.0',
      'through@2.3.8',
      'tmp@0.0.33',
      'to-array@0.1.4',
      'type-check@0.3.2',
      'typedarray@0.0.6',
      'util-deprecate@1.0.2',
      'which@1.3.1',
      'wordwrap@1.0.0',
      'wrappy@1.0.2',
      'write@0.2.1',
      'yallist@2.1.2',
    ].sort(),
    'depGraph looks fine',
  );
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

test('`test yarn-package --file=yarn.lock ` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('yarn-package', { file: 'yarn.lock' });
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

test('`test yarn-package --file=yarn.lock --dev` sends pkg info', async (t) => {
  chdirWorkspaces();
  await cli.test('yarn-package', { file: 'yarn.lock', dev: true });
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

test('`test yarn-package-with-subfolder --file=yarn.lock ` picks top-level files', async (t) => {
  chdirWorkspaces();
  await cli.test('yarn-package-with-subfolder', { file: 'yarn.lock' });
  const req = server.popRequest();
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['yarn-package-top-level@1.0.0', 'to-array@0.1.4'].sort(),
    'depGraph looks fine',
  );
});

test('`test yarn-package-with-subfolder --file=subfolder/yarn.lock ` picks subfolder files', async (t) => {
  chdirWorkspaces();
  await cli.test('yarn-package-with-subfolder', {
    file: 'subfolder/yarn.lock',
  });
  const req = server.popRequest();
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['yarn-package-subfolder@1.0.0', 'to-array@0.1.4'].sort(),
    'depGraph looks fine',
  );
});

test('`test` on a yarn package does work and displays appropriate text', async (t) => {
  chdirWorkspaces('yarn-app');
  await cli.test();
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.match(req.body.targetFile, undefined, 'target is undefined');
  const depGraph = req.body.depGraph;
  t.same(
    depGraph.pkgs.map((p) => p.id).sort(),
    ['yarn-app-one@1.0.0', 'marked@0.3.6', 'moment@2.18.1'].sort(),
    'depGraph looks fine',
  );
});

test('`test pip-app --file=requirements.txt`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('pip').returns(plugin);

  await cli.test('pip-app', {
    file: 'requirements.txt',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pip-app',
      'requirements.txt',
      {
        args: null,
        file: 'requirements.txt',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pip-app',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
  );
});

test('`test pipenv-app --file=Pipfile`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        plugin: {
          targetFile: 'Pipfile',
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

  await cli.test('pipenv-app', {
    file: 'Pipfile',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'Pipfile', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pipenv-app',
      'Pipfile',
      {
        args: null,
        file: 'Pipfile',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pipenv-app',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
  );
});

test('`test pip-app-transitive-vuln --file=requirements.txt (actionableCliRemediation=false)`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return loadJson('./pip-app-transitive-vuln/inspect-result.json');
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('pip').returns(plugin);

  server.setNextResponse(
    loadJson('./pip-app-transitive-vuln/response-without-remediation.json'),
  );
  try {
    await cli.test('pip-app-transitive-vuln', {
      file: 'requirements.txt',
    });
    t.fail('should throw, since there are vulns');
  } catch (e) {
    t.equals(
      e.message,
      fs.readFileSync('pip-app-transitive-vuln/cli-output.txt', 'utf8'),
    );
  }
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pip-app-transitive-vuln',
      'requirements.txt',
      {
        args: null,
        file: 'requirements.txt',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pip-app-transitive-vuln',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
  );
});

test('`test pip-app-transitive-vuln --file=requirements.txt (actionableCliRemediation=true)`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return loadJson('./pip-app-transitive-vuln/inspect-result.json');
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('pip').returns(plugin);

  server.setNextResponse(
    loadJson('./pip-app-transitive-vuln/response-with-remediation.json'),
  );
  try {
    await cli.test('pip-app-transitive-vuln', {
      file: 'requirements.txt',
    });
    t.fail('should throw, since there are vulns');
  } catch (e) {
    t.equals(
      e.message,
      fs.readFileSync(
        'pip-app-transitive-vuln/cli-output-actionable-remediation.txt',
        'utf8',
      ),
    );
  }
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'pip');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'pip-app-transitive-vuln',
      'requirements.txt',
      {
        args: null,
        file: 'requirements.txt',
        org: null,
        projectName: null,
        packageManager: 'pip',
        path: 'pip-app-transitive-vuln',
        showVulnPaths: 'some',
      },
    ],
    'calls python plugin',
  );
});

test('`test nuget-app --file=project.assets.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'project.assets.json',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app', {
    file: 'project.assets.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'project.assets.json', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app',
      'project.assets.json',
      {
        args: null,
        file: 'project.assets.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app --file=packages.config`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'packages.config',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app', {
    file: 'packages.config',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'packages.config', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app',
      'packages.config',
      {
        args: null,
        file: 'packages.config',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test nuget-app --file=project.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'project.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('nuget-app', {
    file: 'project.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.targetFile, 'project.json', 'specifies target');
  t.equal(req.body.depGraph.pkgManager.name, 'nuget');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'nuget-app',
      'project.json',
      {
        args: null,
        file: 'project.json',
        org: null,
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test paket-app --file=paket.dependencies`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'snyk-nuget-plugin',
          targetFile: 'paket.dependencies',
          targetRuntime: 'net465s',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('paket').returns(plugin);

  await cli.test('paket-app', {
    file: 'paket.dependencies',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'paket');
  t.equal(req.body.targetFile, 'paket.dependencies', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'paket-app',
      'paket.dependencies',
      {
        args: null,
        file: 'paket.dependencies',
        org: null,
        projectName: null,
        packageManager: 'paket',
        path: 'paket-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test golang-gomodules --file=go.mod`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'go.mod',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gomodules').returns(plugin);

  await cli.test('golang-gomodules', {
    file: 'go.mod',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'gomodules');
  t.equal(req.body.targetFile, 'go.mod', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-gomodules',
      'go.mod',
      {
        args: null,
        file: 'go.mod',
        org: null,
        projectName: null,
        packageManager: 'gomodules',
        path: 'golang-gomodules',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app` auto-detects golang-gomodules', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'go.mod',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('gomodules').returns(plugin);

  await cli.test('golang-gomodules');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'gomodules');
  t.equal(req.body.targetFile, 'go.mod', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-gomodules',
      'go.mod',
      {
        args: null,
        file: 'go.mod',
        org: null,
        projectName: null,
        packageManager: 'gomodules',
        path: 'golang-gomodules',
        showVulnPaths: 'some',
      },
    ],
    'calls golang-gomodules plugin',
  );
});

test('`test golang-app --file=Gopkg.lock`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'Gopkg.lock',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('golangdep').returns(plugin);

  await cli.test('golang-app', {
    file: 'Gopkg.lock',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
  t.equal(req.body.targetFile, 'Gopkg.lock', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app',
      'Gopkg.lock',
      {
        args: null,
        file: 'Gopkg.lock',
        org: null,
        projectName: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app --file=vendor/vendor.json`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'vendor/vendor.json',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('govendor').returns(plugin);

  await cli.test('golang-app', {
    file: 'vendor/vendor.json',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'govendor');
  t.equal(req.body.targetFile, 'vendor/vendor.json', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app',
      'vendor/vendor.json',
      {
        args: null,
        file: 'vendor/vendor.json',
        org: null,
        projectName: null,
        packageManager: 'govendor',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app` auto-detects golang/dep', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: {
          name: 'testplugin',
          runtime: 'testruntime',
          targetFile: 'Gopkg.lock',
        },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('golangdep').returns(plugin);

  await cli.test('golang-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
  t.equal(req.body.targetFile, 'Gopkg.lock', 'specifies target');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app',
      'Gopkg.lock',
      {
        args: null,
        file: 'Gopkg.lock',
        org: null,
        projectName: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test golang-app-govendor` auto-detects govendor', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('govendor').returns(plugin);

  await cli.test('golang-app-govendor');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'govendor');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'golang-app-govendor',
      'vendor/vendor.json',
      {
        args: null,
        file: 'vendor/vendor.json',
        org: null,
        projectName: null,
        packageManager: 'govendor',
        path: 'golang-app-govendor',
        showVulnPaths: 'some',
      },
    ],
    'calls golang plugin',
  );
});

test('`test composer-app --file=composer.lock`', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);

  await cli.test('composer-app', {
    file: 'composer.lock',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'composer');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'composer-app',
      'composer.lock',
      {
        args: null,
        file: 'composer.lock',
        org: null,
        projectName: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: 'some',
      },
    ],
    'calls composer plugin',
  );
});

test('`test composer-app` auto-detects composer.lock', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);

  await cli.test('composer-app');
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'composer');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'composer-app',
      'composer.lock',
      {
        args: null,
        file: 'composer.lock',
        org: null,
        projectName: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: 'some',
      },
    ],
    'calls composer plugin',
  );
});

test('`test composer-app golang-app nuget-app` auto-detects all three projects', async (t) => {
  chdirWorkspaces();
  const plugin = {
    async inspect() {
      return {
        package: {},
        plugin: { name: 'testplugin', runtime: 'testruntime' },
      };
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');

  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  t.teardown(loadPlugin.restore);
  loadPlugin.withArgs('composer').returns(plugin);
  loadPlugin.withArgs('golangdep').returns(plugin);
  loadPlugin.withArgs('nuget').returns(plugin);

  await cli.test('composer-app', 'golang-app', 'nuget-app', {
    org: 'test-org',
  });
  // assert three API calls made, each with a different url
  const reqs = Array.from({ length: 3 }).map(() => server.popRequest());

  t.same(
    reqs.map((r) => r.method),
    ['POST', 'POST', 'POST'],
    'all post requests',
  );

  t.same(
    reqs.map((r) => r.headers['x-snyk-cli-version']),
    [versionNumber, versionNumber, versionNumber],
    'all send version number',
  );

  t.same(
    reqs.map((r) => r.url),
    [
      '/api/v1/test-dep-graph?org=test-org',
      '/api/v1/test-dep-graph?org=test-org',
      '/api/v1/test-dep-graph?org=test-org',
    ],
    'all urls are present',
  );

  t.same(
    reqs.map((r) => r.body.depGraph.pkgManager.name).sort(),
    ['composer', 'golangdep', 'nuget'],
    'all urls are present',
  );

  // assert three spyPlugin calls, each with a different app
  const calls = spyPlugin.getCalls().sort((call1: any, call2: any) => {
    return call1.args[0] < call2.args[1]
      ? -1
      : call1.args[0] > call2.args[0]
      ? 1
      : 0;
  });
  t.same(
    calls[0].args,
    [
      'composer-app',
      'composer.lock',
      {
        args: null,
        org: 'test-org',
        file: 'composer.lock',
        projectName: null,
        packageManager: 'composer',
        path: 'composer-app',
        showVulnPaths: 'some',
      },
    ],
    'calls composer plugin',
  );
  t.same(
    calls[1].args,
    [
      'golang-app',
      'Gopkg.lock',
      {
        args: null,
        org: 'test-org',
        file: 'Gopkg.lock',
        projectName: null,
        packageManager: 'golangdep',
        path: 'golang-app',
        showVulnPaths: 'some',
      },
    ],
    'calls golangdep plugin',
  );
  t.same(
    calls[2].args,
    [
      'nuget-app',
      'project.assets.json',
      {
        args: null,
        org: 'test-org',
        file: 'project.assets.json',
        projectName: null,
        packageManager: 'nuget',
        path: 'nuget-app',
        showVulnPaths: 'some',
      },
    ],
    'calls nuget plugin',
  );
});

test('`test foo:latest --docker`', async (t) => {
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {},
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`test foo:latest --docker vulnerable paths`', async (t) => {
  stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {
        name: 'docker-image',
        dependencies: {
          'apt/libapt-pkg5.0': {
            version: '1.6.3ubuntu0.1',
            dependencies: {
              'bzip2/libbz2-1.0': {
                version: '1.0.6-8.1',
              },
            },
          },
          'bzip2/libbz2-1.0': {
            version: '1.0.6-8.1',
          },
        },
      },
    },
    t,
  );

  const vulns = require('./fixtures/docker/find-result.json');
  server.setNextResponse(vulns);

  try {
    await cli.test('foo:latest', {
      docker: true,
      org: 'explicit-org',
    });
    t.fail('should have found vuln');
  } catch (err) {
    const msg = err.message;
    t.match(
      msg,
      'Tested 2 dependencies for known vulnerabilities, found 1 vulnerability',
    );
    t.match(msg, 'From: bzip2/libbz2-1.0@1.0.6-8.1');
    t.match(
      msg,
      'From: apt/libapt-pkg5.0@1.6.3ubuntu0.1 > bzip2/libbz2-1.0@1.0.6-8.1',
    );
    t.false(
      msg.includes('vulnerable paths'),
      'docker should not includes number of vulnerable paths',
    );
  }
});

test('`test foo:latest --docker --file=Dockerfile`', async (t) => {
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {
        docker: {
          baseImage: 'ubuntu:14.04',
        },
      },
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    file: 'Dockerfile',
  });

  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.equal(req.body.docker.baseImage, 'ubuntu:14.04', 'posts docker baseImage');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      'Dockerfile',
      {
        args: null,
        file: 'Dockerfile',
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`test foo:latest --docker --file=Dockerfile remediation advice`', async (t) => {
  stubDockerPluginResponse('./fixtures/docker/plugin-multiple-deps', t);
  const vulns = require('./fixtures/docker/find-result-remediation.json');
  server.setNextResponse(vulns);

  try {
    await cli.test('foo:latest', {
      docker: true,
      org: 'explicit-org',
      file: 'Dockerfile',
    });
    t.fail('should have found vuln');
  } catch (err) {
    const msg = err.message;
    t.match(msg, 'Base Image');
    t.match(msg, 'Recommendations for base image upgrade');
  }
});

test('`test foo:latest --docker` doesnt collect policy from cwd', async (t) => {
  chdirWorkspaces('npm-package-policy');
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {},
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
  const policyString = req.body.policy;
  t.false(policyString, 'policy not sent');
});

test('`test foo:latest --docker` supports custom policy', async (t) => {
  chdirWorkspaces();
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {},
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
    'policy-path': 'npm-package-policy/custom-location',
  });
  const req = server.popRequest();
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
        'policy-path': 'npm-package-policy/custom-location',
      },
    ],
    'calls docker plugin with expected arguments',
  );

  const expected = fs.readFileSync(
    path.join('npm-package-policy/custom-location', '.snyk'),
    'utf8',
  );
  const policyString = req.body.policy;
  t.equal(policyString, expected, 'sends correct policy');
});

test('`test foo:latest --docker with binaries`', async (t) => {
  const spyPlugin = stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {
        docker: {
          binaries: [{ name: 'node', version: '5.10.1' }],
        },
      },
    },
    t,
  );

  await cli.test('foo:latest', {
    docker: true,
    org: 'explicit-org',
  });
  const req = server.popRequest();
  t.equal(req.method, 'POST', 'makes POST request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/test-dep-graph', 'posts to correct url');
  t.equal(req.body.depGraph.pkgManager.name, 'deb');
  t.same(
    req.body.docker.binaries,
    [{ name: 'node', version: '5.10.1' }],
    'posts docker binaries',
  );
  t.same(
    spyPlugin.getCall(0).args,
    [
      'foo:latest',
      null,
      {
        args: null,
        file: null,
        docker: true,
        org: 'explicit-org',
        projectName: null,
        packageManager: null,
        path: 'foo:latest',
        showVulnPaths: 'some',
      },
    ],
    'calls docker plugin with expected arguments',
  );
});

test('`test foo:latest --docker with binaries vulnerabilities`', async (t) => {
  stubDockerPluginResponse(
    {
      plugin: {
        packageManager: 'deb',
      },
      package: {
        name: 'docker-image',
        dependencies: {
          'apt/libapt-pkg5.0': {
            version: '1.6.3ubuntu0.1',
            dependencies: {
              'bzip2/libbz2-1.0': {
                version: '1.0.6-8.1',
              },
            },
          },
          'bzip2/libbz2-1.0': {
            version: '1.0.6-8.1',
          },
          'bzr/libbz2-1.0': {
            version: '1.0.6-8.1',
          },
        },
        docker: {
          binaries: {
            Analysis: [{ name: 'node', version: '5.10.1' }],
          },
        },
      },
    },
    t,
  );

  const vulns = require('./fixtures/docker/find-result-binaries.json');
  server.setNextResponse(vulns);

  try {
    await cli.test('foo:latest', {
      docker: true,
      org: 'explicit-org',
    });
    t.fail('should have found vuln');
  } catch (err) {
    const msg = err.message;
    t.match(
      msg,
      'Tested 3 dependencies for known vulnerabilities, found 3 vulnerabilities',
    );
    t.match(msg, 'From: bzip2/libbz2-1.0@1.0.6-8.1');
    t.match(
      msg,
      'From: apt/libapt-pkg5.0@1.6.3ubuntu0.1 > bzip2/libbz2-1.0@1.0.6-8.1',
    );
    t.match(msg, 'Info: http://localhost:12345/vuln/SNYK-UPSTREAM-NODE-72359');
    t.false(
      msg.includes('vulnerable paths'),
      'docker should not includes number of vulnerable paths',
    );
    t.match(msg, 'Detected 2 vulnerabilities for node@5.10.1');
    t.match(msg, 'High severity vulnerability found in node');
    t.match(msg, 'Fixed in: 5.13.1');
    t.match(msg, 'Fixed in: 5.15.1');
  }
});

test('`test --policy-path`', async (tt) => {
  tt.test('default policy', async (t) => {
    chdirWorkspaces('npm-package-policy');
    const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    const vulns = require('./fixtures/npm-package-policy/test-graph-result.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    try {
      await cli.test('.', {
        json: true,
      });
      t.fail('should have reported vulns');
    } catch (res) {
      const req = server.popRequest();
      const policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');

      const output = JSON.parse(res.message);
      const ignore = output.filtered.ignore;
      const vulnerabilities = output.vulnerabilities;
      t.equal(ignore.length, 1, 'one ignore rule');
      t.equal(ignore[0].id, 'npm:marked:20170907', 'ignore correct');
      t.equal(vulnerabilities.length, 1, 'one vuln');
      t.equal(vulnerabilities[0].id, 'npm:marked:20170112', 'vuln correct');
    }
  });

  tt.test('custom policy path', async (t) => {
    chdirWorkspaces('npm-package-policy');

    const expected = fs.readFileSync(
      path.join('custom-location', '.snyk'),
      'utf8',
    );
    const vulns = require('./fixtures/npm-package-policy/test-graph-result.json');
    vulns.policy = expected;
    server.setNextResponse(vulns);

    const res = await cli.test('.', {
      'policy-path': 'custom-location',
      json: true,
    });
    const req = server.popRequest();
    const policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');

    const output = JSON.parse(res);
    const ignore = output.filtered.ignore;
    const vulnerabilities = output.vulnerabilities;
    t.equal(ignore.length, 2, 'two ignore rules');
    t.equal(ignore[0].id, 'npm:marked:20170112', 'first ignore correct');
    t.equal(ignore[1].id, 'npm:marked:20170907', 'second ignore correct');
    t.equal(vulnerabilities.length, 0, 'all vulns ignored');
  });

  tt.test('api ignores policy', async (t) => {
    chdirWorkspaces('npm-package-policy');
    const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
    const policy = await snykPolicy.loadFromText(expected);
    policy.ignore['npm:marked:20170112'] = [
      { '*': { reasonType: 'wont-fix', source: 'api' } },
    ];

    const vulns = require('./fixtures/npm-package-policy/test-graph-result.json');
    vulns.meta.policy = policy.toString();
    server.setNextResponse(vulns);

    const res = await cli.test('.', {
      json: true,
    });
    const req = server.popRequest();
    const policyString = req.body.policy;
    t.equal(policyString, expected, 'sends correct policy');

    const output = JSON.parse(res);
    const ignore = output.filtered.ignore;
    const vulnerabilities = output.vulnerabilities;
    t.equal(ignore.length, 2, 'two ignore rules');
    t.equal(vulnerabilities.length, 0, 'no vulns');
  });
});

test('`test npm-package-with-git-url ` handles git url with patch policy', async (t) => {
  chdirWorkspaces('npm-package-with-git-url');
  const vulns = require('./fixtures/npm-package-with-git-url/test-graph-result.json');
  server.setNextResponse(vulns);
  try {
    await cli.test();
    t.fail('should fail');
  } catch (res) {
    server.popRequest();

    t.match(res.message, 'for known vulnerabilities', 'found results');

    t.match(res.message, 'Local Snyk policy: found', 'found policy file');
  }
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

/**
 * `monitor`
 */
test('`monitor --policy-path`', async (tt) => {
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
  await cli.monitor({
    file: __dirname + '/../fixtures/package-sans-name/package.json',
  });
  t.pass('succeed');
});

test('monitor for package with no name in lockfile', async (t) => {
  await cli.monitor({
    file:
      __dirname + '/../fixtures/package-sans-name-lockfile/package-lock.json',
  });
  t.pass('succeed');
});

test('`monitor npm-package with experimental-dep-graph not enabled`', async (t) => {
  chdirWorkspaces();

  const featureFlagRequestStub = sinon
    .stub(needle, 'request')
    .yields(null, null, { ok: false });

  try {
    await cli.monitor('npm-package', { 'experimental-dep-graph': true });
    t.fail('shoud have thrown an error');
  } catch (e) {
    t.equal(e.name, 'UnsupportedFeatureFlagError', 'correct error was thrown');
    t.equal(
      e.userMessage,
      "Feature flag 'experimental-dep-graph' is not currently enabled for your org, " +
        'to enable please contact snyk support',
      'correct default error message',
    );

    featureFlagRequestStub.restore();
  }
});

test('`monitor npm-package`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('npm-package');
  const req = server.popRequest();
  const pkg = req.body.package;
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/monitor/npm', 'puts at correct url');
  t.ok(pkg.dependencies.debug, 'dependency');
  t.notOk(req.body.targetFile, 'doesnt send the targetFile');
  t.notOk(pkg.dependencies['object-assign'], 'no dev dependency');
  t.notOk(pkg.from, 'no "from" array on root');
  t.notOk(pkg.dependencies.debug.from, 'no "from" array on dep');
  t.notOk(req.body.meta.prePruneDepCount, "doesn't send meta.prePruneDepCount");
});

test('`monitor npm-out-of-sync`', async (t) => {
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
  t.match(req.url, '/monitor/npm', 'puts at correct url');
  t.ok(req.body.meta.prePruneDepCount, 'sends meta.prePruneDepCount');
  const adc = req.body.package.dependencies.a.dependencies.d.dependencies.c;
  t.ok(adc.labels.pruned, 'a.d.c is pruned');
  t.notOk(adc.dependencies, 'a.d.c has no dependencies');
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

test('`monitor sbt package --experimental-dep-graph --sbt-graph`', async (t) => {
  chdirWorkspaces();

  const plugin = {
    async inspect() {
      return {
        plugin: { name: 'sbt' },
        package: require('./workspaces/sbt-simple-struts/monitor-graph-result.json'),
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
});

test('`monitor yarn-package`', async (t) => {
  chdirWorkspaces();
  await cli.monitor('yarn-package');
  const req = server.popRequest();
  const pkg = req.body.package;
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/monitor/yarn', 'puts at correct url');
  t.ok(pkg.dependencies.debug, 'dependency');
  t.notOk(req.body.targetFile, 'doesnt send the targetFile');
  t.notOk(pkg.dependencies['object-assign'], 'no dev dependency');
  t.notOk(pkg.from, 'no "from" array on root');
  t.notOk(pkg.dependencies.debug.from, 'no "from" array on dep');
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
  t.match(req.url, '/monitor/npm', 'puts at correct url');
  t.ok(req.body.package.dependencies.debug, 'dependency');
  t.ok(
    req.body.package.dependencies['object-assign'],
    'includes dev dependency',
  );
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
  t.match(req.url, '/monitor/yarn', 'puts at correct url');
  t.notOk(req.body.targetFile, 'doesnt send the targetFile');
  t.ok(req.body.package.dependencies.debug, 'dependency');
  t.ok(
    req.body.package.dependencies['object-assign'],
    'includes dev dependency',
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

test('`monitor yarn-app`', async (t) => {
  chdirWorkspaces('yarn-app');
  await cli.monitor();
  const req = server.popRequest();
  const pkg = req.body.package;
  t.equal(req.method, 'PUT', 'makes PUT request');
  t.equal(
    req.headers['x-snyk-cli-version'],
    versionNumber,
    'sends version number',
  );
  t.match(req.url, '/monitor/yarn', 'puts at correct url');
  t.equal(pkg.name, 'yarn-app-one', 'specifies name');
  t.ok(pkg.dependencies.marked, 'specifies dependency');
  t.equal(pkg.dependencies.marked.name, 'marked', 'marked dep name');
  t.equal(pkg.dependencies.marked.version, '0.3.6', 'marked dep version');
  t.notOk(req.body.targetFile, 'doesnt send the targetFile');
  t.notOk(pkg.from, 'no "from" array on root');
  t.notOk(pkg.dependencies.marked.from, 'no "from" array on dep');
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
      },
    ],
    'calls gradle plugin',
  );
});

test('`monitor gradle-app pip-app --all-sub-projects`', async (t) => {
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
      },
    ],
    'calls plugin for the 2nd path',
  );
});

test('`monitor gradle-app --all-sub-projects --project-name`', async (t) => {
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
      },
    ],
    'calls golang plugin',
  );
});

test('`monitor cocoapods-app`', async (t) => {
  chdirWorkspaces();
  try {
    await cli.test('cocoapods-app');
    t.fail('should have failed');
  } catch (err) {
    t.pass('throws err');
    t.match(
      err.message,
      'Could not detect supported target files in cocoapods-app.' +
        '\nPlease see our documentation for supported' +
        ' languages and target files: ' +
        'https://support.snyk.io/hc/en-us/articles/360000911957-Language-support' +
        ' and make sure you' +
        ' are in the right directory.',
    );
  }
});

test('`monitor cocoapods-app --file=Podfile`', async (t) => {
  chdirWorkspaces();
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

  await cli.monitor('cocoapods-app', {
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
  t.equal(req.body.targetFile, 'Podfile', 'sends the targetFile');
  t.same(
    spyPlugin.getCall(0).args,
    [
      'cocoapods-app',
      'Podfile',
      {
        args: null,
        file: 'Podfile',
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
        org: 'explicit-org',
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
        org: 'explicit-org',
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
        org: 'explicit-org',
        'policy-path': 'custom-location',
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
  chdirWorkspaces('npm-with-dep-missing-policy');

  const vulns = require('./fixtures/npm-package-policy/vulns.json');
  server.setNextResponse(vulns);

  const projectPolicy = fs
    .readFileSync(__dirname + '/workspaces/npm-with-dep-missing-policy/.snyk')
    .toString();

  await cli.protect();
  const req = server.popRequest();
  const policySentToServer = req.body.policy;
  t.equal(policySentToServer, projectPolicy, 'sends correct policy');
  t.end();
});

test('`test --insecure`', async (tt) => {
  chdirWorkspaces('npm-package');

  tt.test('default (insecure false)', async (t) => {
    const requestStub = sinon
      .stub(needle, 'request')
      .callsFake((a, b, c, d, cb) => {
        if (cb) {
          cb(new Error('bail'), {} as any, null);
        }
        return {} as any;
      });
    t.teardown(requestStub.restore);
    try {
      await cli.test('npm-package');
      t.fail('should fail');
    } catch (e) {
      t.notOk(
        (requestStub.firstCall.args[3] as any).rejectUnauthorized,
        'rejectUnauthorized not present (same as true)',
      );
    }
  });

  tt.test('insecure true', async (t) => {
    // Unfortunately, all acceptance tests run through cli/commands
    // which bypasses `args`, and `ignoreUnknownCA` is a global set
    // by `args`, so we simply set the global here.
    // NOTE: due to this we add tests to `args.test.js`
    (global as any).ignoreUnknownCA = true;
    const requestStub = sinon
      .stub(needle, 'request')
      .callsFake((a, b, c, d, cb) => {
        if (cb) {
          cb(new Error('bail'), {} as any, null);
        }
        return {} as any;
      });
    t.teardown(() => {
      delete (global as any).ignoreUnknownCA;
      requestStub.restore();
    });
    try {
      await cli.test('npm-package');
      t.fail('should fail');
    } catch (e) {
      t.false(
        (requestStub.firstCall.args[3] as any).rejectUnauthorized,
        'rejectUnauthorized false',
      );
    }
  });
});

test("snyk help doesn't crash", async (t) => {
  t.match(await cli.help(), /Usage/);
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

test('error 401 handling', async (t) => {
  chdirWorkspaces();

  server.setNextStatusCodeAndResponse(401, {});

  try {
    await cli.test('ruby-app-thresholds');
    t.fail('should have thrown');
  } catch (err) {
    t.match(
      err.message,
      /Authentication failed. Please check the API token on/,
    );
  }
});

test('error 403 handling', async (t) => {
  chdirWorkspaces();

  server.setNextStatusCodeAndResponse(403, {});

  try {
    await cli.test('ruby-app-thresholds');
    t.fail('should have thrown');
  } catch (err) {
    t.match(
      err.message,
      /Authentication failed. Please check the API token on/,
    );
  }
});

test('error 500 handling', async (t) => {
  chdirWorkspaces();

  server.setNextStatusCodeAndResponse(500, {});

  try {
    await cli.test('ruby-app-thresholds');
    t.fail('should have thrown');
  } catch (err) {
    t.match(err.message, 'Internal server error');
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

function chdirWorkspaces(subdir: string = '') {
  process.chdir(__dirname + '/workspaces' + (subdir ? '/' + subdir : ''));
}

function decode64(str) {
  return Buffer.from(str, 'base64').toString('utf8');
}

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
