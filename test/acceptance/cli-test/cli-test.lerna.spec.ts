import * as sinon from 'sinon';

import { AcceptanceTests } from './cli-test.acceptance.test';
const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);

export const LernaPackagesTests: AcceptanceTests = {
  language: 'Lerna',
  tests: {
    // yarn lockfile based testing is only supported for node 4+
    '`test yarn-lerna-out-of-sync --lerna-packages` out of sync fails': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('yarn-lerna-out-of-sync', {
          dev: true,
          lernaPackages: true,
          detectionDepth: 3,
        });
        t.fail('Should fail');
      } catch (e) {
        t.equal(
          e.message,
          '\nTesting yarn-lerna-out-of-sync...\n\n' +
            'Dependency snyk was not found in yarn.lock.' +
            ' Your package.json and yarn.lock are probably out of sync.' +
            ' Please run "yarn install" and try again.',
          'Contains enough info about err',
        );
      }
    },
    '`test yarn-lerna-out-of-sync --lerna-packages --strict-out-of-sync=false --dev` passes': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const result = await params.cli.test('yarn-lerna-out-of-sync', {
        dev: true,
        strictOutOfSync: false,
        lernaPackages: true,
      });
      params.server.popRequests(3).forEach((req) => {
        t.ok(req.body.depGraph, 'body contains depGraph');
        t.true(
          req.body.depGraph.pkgs
            .map((p) => p.id)
            .sort()
            .includes('ansi-regex@2.1.1'),
          'contains dev packages',
        );
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
      });
      t.match(
        result.getDisplayResults(),
        'Tested 3 projects, no vulnerable paths were found.',
        'correctly showing project number',
      );
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
    },
    'test --lerna-packages --detection-depth=5': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const result = await params.cli.test('yarn-workspaces', {
        lernaPackages: true,
        detectionDepth: 5,
      });
      const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');
      // the parser is used directly
      t.ok(loadPlugin.withArgs('yarn').notCalled, 'skips load plugin');
      t.teardown(() => {
        loadPlugin.restore();
      });
      t.match(
        result.getDisplayResults(),
        'Tested 3 projects, no vulnerable paths were found.',
        'correctly showing project number',
      );
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
      let policyCount = 0;
      const applesWorkspace =
        process.platform === 'win32'
          ? '\\apples\\package.json'
          : 'apples/package.json';
      const tomatoesWorkspace =
        process.platform === 'win32'
          ? '\\tomatoes\\package.json'
          : 'tomatoes/package.json';
      const rootWorkspace =
        process.platform === 'win32'
          ? '\\yarn-workspaces\\package.json'
          : 'yarn-workspaces/package.json';

      params.server.popRequests(3).forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
        t.ok(req.body.depGraph, 'body contains depGraph');

        if (req.body.targetFileRelativePath.endsWith(applesWorkspace)) {
          t.match(
            req.body.policy,
            'npm:node-uuid:20160328',
            'policy is as expected',
          );
          t.ok(req.body.policy, 'body contains policy');
          policyCount += 1;
        } else if (
          req.body.targetFileRelativePath.endsWith(tomatoesWorkspace)
        ) {
          t.notOk(req.body.policy, 'body does not contain policy');
        } else if (req.body.targetFileRelativePath.endsWith(rootWorkspace)) {
          t.match(
            req.body.policy,
            'npm:node-uuid:20111130',
            'policy is as expected',
          );
          t.ok(req.body.policy, 'body contains policy');
          policyCount += 1;
        }
        t.equal(
          req.body.depGraph.pkgManager.name,
          'yarn',
          'depGraph has package manager',
        );
      });
      t.equal(policyCount, 2, '2 policies found in a workspace');
    },
    'test --lerna-packages --detection-depth=5 --strict-out-of-sync=false (yarn v2)': (
      params,
      utils,
    ) => async (t) => {
      // Yarn workspaces for Yarn 2 is only supported on Node 10+
      if (nodeVersion < 10) {
        return t.skip();
      }
      utils.chdirWorkspaces();
      const result = await params.cli.test('yarn-workspaces-v2', {
        lernaPackages: true,
        detectionDepth: 5,
        strictOutOfSync: false,
      });
      const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');
      // the parser is used directly
      t.ok(loadPlugin.withArgs('yarn').notCalled, 'skips load plugin');
      t.teardown(() => {
        loadPlugin.restore();
      });
      t.match(
        result.getDisplayResults(),
        '✓ Tested 1 dependencies for known vulnerabilities, no vulnerable paths found.',
        'correctly showing dep number',
      );
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
    },
    'test --lerna-packages multiple package monorepos found': (
      params,
      utils,
    ) => async (t) => {
      // Yarn workspaces for Yarn 2 is only supported on Node 10+
      if (nodeVersion < 10) {
        return t.skip();
      }
      utils.chdirWorkspaces();
      const result = await params.cli.test({
        lernaPackages: true,
        strictOutOfSync: false,
      });
      const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');
      // the parser is used directly
      t.ok(loadPlugin.withArgs('yarn').notCalled, 'skips load plugin');
      t.teardown(() => {
        loadPlugin.restore();
      });
      t.match(
        result.getDisplayResults(),
        '✓ Tested 1 dependencies for known vulnerabilities, no vulnerable paths found.',
        'correctly showing dep number',
      );
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
        'Tested 17 projects, no vulnerable paths were found.',
        'Tested 17 projects',
      );
      params.server.popRequests(17).forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
        t.ok(req.body.depGraph, 'body contains depGraph');
        t.equal(
          req.body.depGraph.pkgManager.name,
          'yarn',
          'depGraph has package manager',
        );
      });
    },
  },
};
