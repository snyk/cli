import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as needle from 'needle';
import * as Ajv from 'ajv';
import * as sarifSchema from './sarif-schema-2.1.0';
import { AcceptanceTests } from '../cli-test.acceptance.test';

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as snykPolicy from 'snyk-policy';
import { getFixturePath } from '../../jest/util/getFixturePath';

const readJSON = (jsonPath: string) => {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, jsonPath), 'utf-8'),
  );
};

export const GenericTests: AcceptanceTests = {
  language: 'Generic Test tests',
  tests: {
    'test cli with multiple params: good and bad': (params) => async (t) => {
      t.plan(6);
      try {
        await params.cli.test('/', 'semver', {
          registry: 'npm',
          org: 'EFF',
          json: true,
        });
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
    },

    '`test ` test missing container image': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test({ docker: true });
        t.fail('should have failed');
      } catch (err) {
        t.match(
          err.message,
          'Could not detect an image. Specify an image name to scan and try running the command again.',
          'show err message',
        );
        t.pass('throws err');
      }
    },

    'userMessage and error code correctly bubbles with npm': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('npm-package', { org: 'missing-org' });
        t.fail('expect to err');
      } catch (err) {
        t.equal(
          err.userMessage,
          'Org missing-org was not found or you may not have the correct permissions',
          'got correct err message',
        );
        t.equal(err.code, 404);
      }
      t.end();
    },

    'userMessage and error code correctly bubbles with npm and json output': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('npm-package', {
          org: 'missing-org',
          json: true,
        });
        t.fail('expect to err');
      } catch (err) {
        t.has(
          err.jsonStringifiedResults,
          'Org missing-org was not found or you may not have the correct permissions',
          'got correct err message',
        );
        t.equal(err.code, 404);
      }
      t.end();
    },

    'userMessage correctly bubbles with everything other than npm': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('ruby-app', { org: 'missing-org' });
        t.fail('expect to err');
      } catch (err) {
        t.equal(
          err.userMessage,
          'Org missing-org was not found or you may not have the correct permissions',
          'got correct err message',
        );
      }
      t.end();
    },

    /**
     * Remote package `test`
     */

    '`test semver` sends remote NPM request:': (params) => async (t) => {
      // We care about the request here, not the response
      const output = await params.cli.test('semver', {
        registry: 'npm',
        org: 'EFF',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'GET', 'makes GET request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/vuln/npm/semver', 'gets from correct url');
      t.equal(req.query.org, 'EFF', 'org sent as a query in request');
      t.match(
        output.getDisplayResults(),
        'Testing semver',
        'has "Testing semver" message',
      );
      t.notMatch(output, 'Remediation', 'shows no remediation advice');
      t.notMatch(output, 'snyk wizard', 'does not suggest `snyk wizard`');
    },

    '`test sinatra --registry=rubygems` sends remote Rubygems request:': (
      params,
    ) => async (t) => {
      await params.cli.test('sinatra', { registry: 'rubygems', org: 'ACME' });
      const req = params.server.popRequest();
      t.equal(req.method, 'GET', 'makes GET request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/vuln/rubygems/sinatra', 'gets from correct url');
      t.equal(req.query.org, 'ACME', 'org sent as a query in request');
    },

    /**
     * Local source `test`
     */

    '`test /` test for nonexistent with path specified': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('/');
        t.fail('should have failed');
      } catch (err) {
        t.pass('throws err');
        t.match(
          err.message,
          'Could not detect supported target files in /.' +
            '\nPlease see our documentation for supported' +
            ' languages and target files: ' +
            'https://snyk.co/udVgQ' +
            ' and make sure you' +
            ' are in the right directory.',
        );
      }
    },

    '`test empty --file=readme.md`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('empty', { file: 'readme.md' });
        t.fail('should have failed');
      } catch (err) {
        t.pass('throws err');
        t.match(
          err.message,
          'Could not detect package manager for file: readme.md',
          'shows err message for when file specified exists, but not supported',
        );
      }
    },

    '`test --policy-path`': (params, utils) => async (t) => {
      t.plan(3);

      t.test('default policy', async (tt) => {
        utils.chdirWorkspaces('npm-package-policy');
        const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
        const vulns = readJSON(
          getFixturePath('npm-package-policy/test-graph-result.json'),
        );
        vulns.policy = expected;
        params.server.setNextResponse(vulns);

        try {
          await params.cli.test('.', {
            json: true,
          });
          tt.fail('should have reported vulns');
        } catch (res) {
          const req = params.server.popRequest();
          const policyString = req.body.policy;
          tt.equal(policyString, expected, 'sends correct policy');

          const output = JSON.parse(res.message);
          const ignore = output.filtered.ignore;
          const vulnerabilities = output.vulnerabilities;
          tt.equal(ignore.length, 1, 'one ignore rule');
          tt.equal(ignore[0].id, 'npm:marked:20170907', 'ignore correct');
          tt.equal(vulnerabilities.length, 1, 'one vuln');
          tt.equal(
            vulnerabilities[0].id,
            'npm:marked:20170112',
            'vuln correct',
          );
        }
      });

      t.test('custom policy path', async (tt) => {
        utils.chdirWorkspaces('npm-package-policy');

        const expected = fs.readFileSync(
          path.join('custom-location', '.snyk'),
          'utf8',
        );
        const vulns = readJSON(
          getFixturePath('npm-package-policy/test-graph-result.json'),
        );
        vulns.policy = expected;
        params.server.setNextResponse(vulns);

        const res = await params.cli.test('.', {
          'policy-path': 'custom-location',
          json: true,
        });
        const req = params.server.popRequest();
        const policyString = req.body.policy;
        tt.equal(policyString, expected, 'sends correct policy');

        const output = JSON.parse(res);
        const ignore = output.filtered.ignore;
        const vulnerabilities = output.vulnerabilities;
        tt.equal(ignore.length, 2, 'two ignore rules');
        tt.equal(ignore[0].id, 'npm:marked:20170112', 'first ignore correct');
        tt.equal(ignore[1].id, 'npm:marked:20170907', 'second ignore correct');
        tt.equal(vulnerabilities.length, 0, 'all vulns ignored');
      });

      t.test('api ignores policy', async (tt) => {
        utils.chdirWorkspaces('npm-package-policy');
        const expected = fs.readFileSync(path.join('.snyk'), 'utf8');
        const policy = await snykPolicy.loadFromText(expected);
        policy.ignore['npm:marked:20170112'] = [
          { '*': { reasonType: 'wont-fix', source: 'api' } },
        ];

        const vulns = readJSON(
          getFixturePath('npm-package-policy/test-graph-result.json'),
        );
        vulns.meta.policy = policy.toString();
        params.server.setNextResponse(vulns);

        const res = await params.cli.test('.', {
          json: true,
        });
        const req = params.server.popRequest();
        const policyString = req.body.policy;
        tt.equal(policyString, expected, 'sends correct policy');

        const output = JSON.parse(res);
        const ignore = output.filtered.ignore;
        const vulnerabilities = output.vulnerabilities;
        tt.equal(ignore.length, 2, 'two ignore rules');
        tt.equal(vulnerabilities.length, 0, 'no vulns');
      });
    },

    '`test npm-package-with-git-url ` handles git url with patch policy': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces('npm-package-with-git-url');
      const vulns = readJSON(
        getFixturePath('npm-package-with-git-url/test-graph-result.json'),
      );
      params.server.setNextResponse(vulns);
      try {
        await params.cli.test();
        t.fail('should fail');
      } catch (res) {
        params.server.popRequest();

        t.match(res.message, 'for known vulnerabilities', 'found results');

        t.match(res.message, 'Local Snyk policy: found', 'found policy file');
      }
    },

    '`test --insecure`': (params, utils) => async (t) => {
      t.plan(2);
      utils.chdirWorkspaces('npm-package');

      t.test('default (insecure false)', async (tt) => {
        const requestStub = sinon
          .stub(needle, 'request')
          .callsFake((a, b, c, d, cb) => {
            if (cb) {
              cb(new Error('bail'), {} as any, null);
            }
            return {} as any;
          });
        tt.teardown(requestStub.restore);
        try {
          await params.cli.test('npm-package');
          tt.fail('should fail');
        } catch (e) {
          tt.notOk(
            (requestStub.firstCall.args[3] as any).rejectUnauthorized,
            'rejectUnauthorized not present (same as true)',
          );
        }
      });

      t.test('insecure true', async (tt) => {
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
        tt.teardown(() => {
          delete (global as any).ignoreUnknownCA;
          requestStub.restore();
        });
        try {
          await params.cli.test('npm-package');
          tt.fail('should fail');
        } catch (e) {
          tt.false(
            (requestStub.firstCall.args[3] as any).rejectUnauthorized,
            'rejectUnauthorized false',
          );
        }
      });
    },

    'error 401 handling': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextStatusCode(401);

      try {
        await params.cli.test('ruby-app-thresholds');
        t.fail('should have thrown');
      } catch (err) {
        t.match(
          err.message,
          /Authentication failed. Please check the API token on/,
        );
      }
    },

    'error 403 handling': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextStatusCode(403);

      try {
        await params.cli.test('ruby-app-thresholds');
        t.fail('should have thrown');
      } catch (err) {
        t.match(
          err.message,
          /Authentication failed. Please check the API token on/,
        );
      }
    },

    'error 500 handling': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextStatusCode(500);

      try {
        await params.cli.test('ruby-app-thresholds');
        t.fail('should have thrown');
      } catch (err) {
        t.match(err.message, 'Internal server error');
      }
    },

    'test --sarif': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      try {
        const vulns = readJSON(
          getFixturePath('npm-package/test-graph-result.json'),
        );
        params.server.setNextResponse(vulns);

        await params.cli.test('npm-package', { sarif: true });
        t.fail('Should fail');
      } catch (err) {
        const sarifObj = JSON.parse(err.message);
        const validate = new Ajv({ allErrors: true }).compile(sarifSchema);
        const valid = validate(sarifObj);
        if (!valid) {
          t.fail(
            validate.errors
              ?.map((e) => `${e.message} - ${JSON.stringify(e.params)}`)
              .join(),
          );
        }
      }
    },
  },
};
