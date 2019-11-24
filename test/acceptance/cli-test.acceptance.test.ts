import * as tap from 'tap';
import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as depGraphLib from '@snyk/dep-graph';
import * as _ from 'lodash';
import * as needle from 'needle';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
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
  t.plan(6);
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

test('`test --policy-path`', async (tt) => {
  tt.plan(3);

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

test('`test --insecure`', async (tt) => {
  tt.plan(2);
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

function chdirWorkspaces(subdir = '') {
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
