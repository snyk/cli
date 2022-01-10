const omit = require('lodash.omit');
const sortBy = require('lodash.sortby');
import { AcceptanceTests } from '../cli-test.acceptance.test';
import { getWorkspaceJSON } from '../../acceptance/workspace-helper';
import { CommandResult } from '../../../src/cli/commands/types';
import * as path from 'path';

export const RubyTests: AcceptanceTests = {
  language: 'Ruby',
  tests: {
    '`test ruby-app-no-lockfile --file=Gemfile`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('ruby-app-no-lockfile', { file: 'Gemfile' });
        t.fail('should have failed');
      } catch (err) {
        t.pass('throws err');
        t.match(err.message, 'Please run `bundle install`', 'shows err');
      }
    },

    '`test ruby-app --file=Gemfile.lock`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('ruby-app', { file: 'Gemfile.lock' });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
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
    },

    '`test ruby-app-custom-names --file=123.gemfile.lock --package-manager=rubygems`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('ruby-app-custom-names', {
        file: '123.gemfile.lock',
        packageManager: 'rubygems',
      });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');

      const depGraph = req.body.depGraph;
      t.equal(depGraph.pkgManager.name, 'rubygems');
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'crass@1.0.4',
          'lynx@0.4.0',
          'mini_portile2@2.3.0',
          'nokogiri@1.8.5',
          'nokogumbo@1.5.0',
          'ruby-app-custom-names@',
          'sanitize@4.6.2',
          'yard@0.8.0',
        ].sort(),
        'depGraph looks fine',
      );
    },
    '`test ruby-app-custom-names --file=123.gemfile --package-manager=rubygems`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('ruby-app-custom-names', {
        file: '123.gemfile',
        packageManager: 'rubygems',
      });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');

      const depGraph = req.body.depGraph;
      t.equal(depGraph.pkgManager.name, 'rubygems');
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'crass@1.0.4',
          'lynx@0.4.0',
          'mini_portile2@2.3.0',
          'nokogiri@1.8.5',
          'nokogumbo@1.5.0',
          'ruby-app-custom-names@',
          'sanitize@4.6.2',
          'yard@0.8.0',
        ].sort(),
        'depGraph looks fine',
      );
    },

    '`test ruby-app-custom-names --file=gemfiles/Gemfile.rails-2.3.6 --package-manager=rubygems`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('ruby-app-custom-names', {
          file: 'gemfiles/Gemfile.rails-2.3.6',
          packageManager: 'rubygems',
        });
      } catch (e) {
        t.match(
          e.message,
          'if this is a custom file name re-run with --file=path/to/custom.gemfile.lock --package-manager=rubygems',
        );
      }
    },

    '`test ruby-app-custom-names --file=gemfiles/Gemfile.rails-2.4.5.lock --package-manager=rubygems`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('ruby-app-custom-names', {
        file: 'gemfiles/Gemfile.rails-2.4.5.lock',
        packageManager: 'rubygems',
      });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');

      const depGraph = req.body.depGraph;
      t.equal(depGraph.pkgManager.name, 'rubygems');
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'crass@1.0.4',
          'lynx@0.4.0',
          'mini_portile2@2.3.0',
          'nokogiri@1.8.5',
          'nokogumbo@1.5.0',
          'ruby-app-custom-names@',
          'sanitize@4.6.2',
          'yard@0.8.0',
        ].sort(),
        'depGraph looks fine',
      );
    },

    '`test ruby-app` meta when no vulns': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const commandResult: CommandResult = await params.cli.test('ruby-app');
      const res = commandResult.getDisplayResults();

      const meta = res.slice(res.indexOf('Organization:')).split('\n');
      t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
      t.match(
        meta[1],
        /Package manager:\s+rubygems/,
        'package manager displayed',
      );
      t.match(meta[2], /Target file:\s+Gemfile/, 'target file displayed');
      t.match(meta[3], /Project name:\s+ruby-app/, 'project name displayed');
      t.match(meta[4], /Open source:\s+no/, 'open source displayed');
      t.match(meta[5], /Project path:\s+ruby-app/, 'path displayed');
      t.notMatch(
        meta[5],
        /Local Snyk policy:\s+found/,
        'local policy not displayed',
      );
    },

    '`test ruby-app-thresholds`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('ruby-app-thresholds', 'test-graph-result.json'),
      );

      try {
        await params.cli.test('ruby-app-thresholds');
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
        t.match(
          meta[5],
          /Project path:\s+ruby-app-thresholds/,
          'path displayed',
        );
        t.notMatch(
          meta[5],
          /Local Snyk policy:\s+found/,
          'local policy not displayed',
        );
      }
    },

    '`test ruby-app-thresholds --severity-threshold=low --json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-low-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          severityThreshold: 'low',
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'low');

        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-result-low-severity.json',
        );

        t.deepEqual(
          omit(res, ['vulnerabilities']),
          omit(expected, ['vulnerabilities']),
          'metadata is ok',
        );
        t.deepEqual(
          sortBy(res.vulnerabilities, 'id'),
          sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },

    '`test ruby-app-thresholds --severity-threshold=medium`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-medium-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          severityThreshold: 'medium',
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'medium');

        const res = err.message;

        t.match(
          res,
          'Tested 7 dependencies for known vulnerabilities, found 5 vulnerabilities, 6 vulnerable paths',
          '5 vulns',
        );
      }
    },

    '`test ruby-app-thresholds --ignore-policy`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-medium-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          'ignore-policy': true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.equal(req.query.ignorePolicy, 'true');
        t.end();
      }
    },

    '`test ruby-app-thresholds --severity-threshold=medium --json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-medium-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          severityThreshold: 'medium',
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'medium');

        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-result-medium-severity.json',
        );

        t.deepEqual(
          omit(res, ['vulnerabilities']),
          omit(expected, ['vulnerabilities']),
          'metadata is ok',
        );
        t.deepEqual(
          sortBy(res.vulnerabilities, 'id'),
          sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },

    '`test ruby-app-thresholds --severity-threshold=high': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-high-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          severityThreshold: 'high',
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'high');

        const res = err.message;

        t.match(
          res,
          'Tested 7 dependencies for known vulnerabilities, found 3 vulnerabilities, 4 vulnerable paths',
          '3 vulns',
        );
      }
    },

    '`test ruby-app-thresholds --severity-threshold=high --json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-high-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          severityThreshold: 'high',
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'high');

        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-result-high-severity.json',
        );

        t.deepEqual(
          omit(res, ['vulnerabilities']),
          omit(expected, ['vulnerabilities']),
          'metadata is ok',
        );
        t.deepEqual(
          sortBy(res.vulnerabilities, 'id'),
          sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },

    '`test ruby-app-thresholds --severity-threshold=critical': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-critical-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          severityThreshold: 'critical',
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'critical');

        const res = err.message;

        t.match(
          res,
          'Tested 7 dependencies for known vulnerabilities, found 1 vulnerability, 2 vulnerable paths',
          '1 vuln',
        );
      }
    },

    '`test ruby-app-thresholds --severity-threshold=critical --json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-critical-severity.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-thresholds', {
          severityThreshold: 'critical',
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'critical');

        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-result-critical-severity.json',
        );

        t.deepEqual(
          omit(res, ['vulnerabilities']),
          omit(expected, ['vulnerabilities']),
          'metadata is ok',
        );
        t.deepEqual(
          sortBy(res.vulnerabilities, 'id'),
          sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },

    '`test ruby-app-policy`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('ruby-app-policy', 'test-graph-result.json'),
      );

      try {
        await params.cli.test('ruby-app-policy', {
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'ruby-app-policy',
          'test-result.json',
        );

        t.deepEqual(
          omit(res, ['vulnerabilities']),
          omit(expected, ['vulnerabilities']),
          'metadata is ok',
        );
        t.deepEqual(
          sortBy(res.vulnerabilities, 'id'),
          sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },

    '`test ruby-app-policy` with cloud ignores': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-policy',
          'test-graph-result-cloud-ignore.json',
        ),
      );

      try {
        await params.cli.test('ruby-app-policy', {
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'ruby-app-policy',
          'test-result-cloud-ignore.json',
        );

        t.deepEqual(
          omit(res, ['vulnerabilities']),
          omit(expected, ['vulnerabilities']),
          'metadata is ok',
        );
        t.deepEqual(
          sortBy(res.vulnerabilities, 'id'),
          sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },

    '`test ruby-app-no-vulns`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('ruby-app-no-vulns', 'test-graph-result.json'),
      );

      const outText = await params.cli.test('ruby-app-no-vulns', {
        json: true,
      });

      const res = JSON.parse(outText);

      const expected = getWorkspaceJSON(
        'ruby-app-no-vulns',
        'test-result.json',
      );

      t.deepEqual(res, expected, '--json output is the same');
    },

    '`test ruby-app-no-vulns` public': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      const apiResponse = Object.assign(
        {},
        getWorkspaceJSON('ruby-app-no-vulns', 'test-graph-result.json'),
      );
      apiResponse.meta.isPublic = true;
      params.server.setNextResponse(apiResponse);

      const outText = await params.cli.test('ruby-app-no-vulns', {
        json: true,
      });

      const res = JSON.parse(outText);

      const expected = Object.assign(
        {},
        getWorkspaceJSON('ruby-app-no-vulns', 'test-result.json'),
        { isPrivate: false },
      );

      t.deepEqual(res, expected, '--json output is the same');
    },

    '`test` returns correct meta when target file specified': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const commandResult: CommandResult = await params.cli.test('ruby-app', {
        file: 'Gemfile.lock',
      });
      const res = commandResult.getDisplayResults();
      const meta = res.slice(res.indexOf('Organization:')).split('\n');
      t.match(meta[2], /Target file:\s+Gemfile.lock/, 'target file displayed');
    },

    '`test ruby-gem-no-lockfile --file=ruby-gem.gemspec`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('ruby-gem-no-lockfile', {
        file: 'ruby-gem.gemspec',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
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
    },

    '`test ruby-gem --file=ruby-gem.gemspec`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('ruby-gem', { file: 'ruby-gem.gemspec' });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
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
    },

    '`test ruby-app` auto-detects Gemfile': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('ruby-app');
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
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
      t.notOk(req.body.targetFile, 'does not specify target');
    },

    '`test monorepo --file=sub-ruby-app/Gemfile`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      await params.cli.test('monorepo', { file: 'sub-ruby-app/Gemfile' });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
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

      t.notOk(req.body.targetFile, 'does not specify target');
    },

    '`test empty --file=Gemfile`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('empty', { file: 'Gemfile' });
        t.fail('should have failed');
      } catch (err) {
        t.pass('throws err');
        t.match(
          err.message,
          'Could not find the specified file: Gemfile',
          'shows err',
        );
      }
    },
    '`test large-mono-repo --file=bundler-app/Gemfile`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const res = await params.cli.test('large-mono-repo', {
        file: 'bundler-app/Gemfile',
      });
      t.match(
        res.getDisplayResults(),
        '--all-projects',
        'Suggest using --all-projects',
      );
    },

    '`test monorepo --all-projects`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('monorepo', { allProjects: true });

      const req = params.server.popRequest();

      const rootNodePkgId = req.body.depGraph.graph.nodes.find(
        (x) => x.nodeId == 'root-node',
      ).pkgId;
      t.equal(rootNodePkgId, `monorepo${path.sep}sub-ruby-app@`);
    },
  },
};
