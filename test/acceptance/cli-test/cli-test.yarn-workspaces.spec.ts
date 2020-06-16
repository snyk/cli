import * as sinon from 'sinon';

import { AcceptanceTests } from './cli-test.acceptance.test';

export const YarnWorkspacesTests: AcceptanceTests = {
  language: 'Yarn',
  tests: {
    // yarn lockfile based testing is only supported for node 4+
    '`test yarn-workspace-out-of-sync --yarn-workspaces` out of sync fails': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('yarn-workspace-out-of-sync', {
          dev: true,
          yarnWorkspaces: true,
          detectionDepth: 3,
        });
        t.fail('Should fail');
      } catch (e) {
        t.equal(
          e.message,
          '\nTesting yarn-workspace-out-of-sync...\n\n' +
            'Dependency snyk was not found in yarn.lock.' +
            ' Your package.json and yarn.lock are probably out of sync.' +
            ' Please run "yarn install" and try again.',
          'Contains enough info about err',
        );
      }
    },
    '`test yarn-workspace-out-of-sync --yarn-workspaces --strict-out-of-sync=false --dev` passes': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-workspace-out-of-sync', {
        dev: true,
        strictOutOfSync: false,
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'ansi-regex@2.1.1',
          'ansi-regex@3.0.0',
          'ansi-styles@3.2.1',
          'balanced-match@1.0.0',
          'bluebird@3.7.2',
          'brace-expansion@1.1.11',
          'camelcase@4.1.0',
          'chalk@2.4.2',
          'cliui@4.1.0',
          'code-point-at@1.1.0',
          'color-convert@1.9.3',
          'color-name@1.1.3',
          'concat-map@0.0.1',
          'cross-spawn@5.1.0',
          'decamelize@1.2.0',
          'escape-string-regexp@1.0.5',
          'execa@0.7.0',
          'find-up@2.1.0',
          'fs.realpath@1.0.0',
          'get-caller-file@1.0.3',
          'get-stream@3.0.0',
          'glob@7.1.6',
          'has-flag@3.0.0',
          'inflight@1.0.6',
          'inherits@2.0.4',
          'invert-kv@1.0.0',
          'is-fullwidth-code-point@1.0.0',
          'is-fullwidth-code-point@2.0.0',
          'is-stream@1.1.0',
          'isexe@2.0.0',
          'lcid@1.0.0',
          'locate-path@2.0.0',
          'lodash@4.17.15',
          'lru-cache@4.1.5',
          'mem@1.1.0',
          'mimic-fn@1.2.0',
          'minimatch@3.0.4',
          'node-fetch@2.6.0',
          'npm-run-path@2.0.2',
          'number-is-nan@1.0.1',
          'once@1.4.0',
          'os-locale@2.1.0',
          'p-finally@1.0.0',
          'p-limit@1.3.0',
          'p-locate@2.0.0',
          'p-try@1.0.0',
          'package.json@',
          'path-exists@3.0.0',
          'path-is-absolute@1.0.1',
          'path-key@2.0.1',
          'pseudomap@1.0.2',
          'require-directory@2.1.1',
          'require-main-filename@1.0.1',
          'set-blocking@2.0.0',
          'shebang-command@1.2.0',
          'shebang-regex@1.0.0',
          'signal-exit@3.0.3',
          'snyk@1.320.0',
          'split@1.0.1',
          'string-width@1.0.2',
          'string-width@2.1.1',
          'strip-ansi@3.0.1',
          'strip-ansi@4.0.0',
          'strip-eof@1.0.0',
          'supports-color@5.5.0',
          'throat@4.1.0',
          'through@2.3.8',
          'which-module@2.0.0',
          'which@1.3.1',
          'wrap-ansi@2.1.0',
          'wrappy@1.0.2',
          'wsrun@3.6.6',
          'y18n@3.2.1',
          'yallist@2.1.2',
          'yargs-parser@8.1.0',
          'yargs@10.1.2',
        ].sort(),
        'depGraph looks fine',
      );
    },
    'test --yarn-workspaces --detection-depth=5': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const result = await params.cli.test('yarn-workspaces', {
        yarnWorkspaces: true,
        detectionDepth: 5,
      });
      const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');
      // the parser is used directly
      t.ok(loadPlugin.withArgs('yarn').notCalled, 'skips load plugin');
      t.match(result.getDisplayResults(), 'Package manager:   yarn\n');
      t.match(
        result.getDisplayResults(),
        'Project name:      package.json',
        'yarn project in output',
      );
      t.match(
        result.getDisplayResults(),
        'Project name:      tomatoes',
        'yarn project in output',
      );
      t.match(
        result.getDisplayResults(),
        'Project name:      apples',
        'yarn project in output',
      );
      t.match(
        result.getDisplayResults(),
        'Tested 3 projects, no vulnerable paths were found.',
        'no vulnerable paths found as both policies detected and applied.',
      );

      params.server.popRequests(3).forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
        t.ok(req.body.depGraph, 'body contains depGraph');
        t.ok(req.body.policy, 'body contains policy');
        t.equal(
          req.body.policyLocations,
          ['yarn-workspaces', 'yarn-workspaces/apples'],
          'policy locations',
        );

        t.equal(
          req.body.depGraph.pkgManager.name,
          'yarn',
          'depGraph has package manager',
        );
      });
    },
  },
};
