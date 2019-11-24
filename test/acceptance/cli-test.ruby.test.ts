import * as tap from 'tap';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as version from '../../src/lib/version';
import * as path from 'path';

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

test('`test` returns correct meta when target file specified', async (t) => {
  chdirWorkspaces();
  const res = await cli.test('ruby-app', { file: 'Gemfile.lock' });
  const meta = res.slice(res.indexOf('Organization:')).split('\n');
  t.match(meta[2], /Target file:\s+Gemfile.lock/, 'target file displayed');
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
