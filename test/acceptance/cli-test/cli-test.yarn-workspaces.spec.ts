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
      const result = await params.cli.test('yarn-workspace-out-of-sync', {
        dev: true,
        strictOutOfSync: false,
        yarnWorkspaces: true,
      });
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
        'Project name:      apple-lib',
        'yarn project in output',
      );
      t.match(
        result.getDisplayResults(),
        'Tested 4 projects, no vulnerable paths were found.',
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

      params.server.popRequests(4).forEach((req) => {
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
    'test --yarn-workspaces --detection-depth=5 --strict-out-of-sync=false (yarn v2)': (
      params,
      utils,
    ) => async (t) => {
      // Yarn workspaces for Yarn 2 is only supported on Node 10+
      utils.chdirWorkspaces();
      const result = await params.cli.test('yarn-workspaces-v2', {
        yarnWorkspaces: true,
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
    'test --yarn-workspaces --detection-depth=5 multiple workspaces found': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const result = await params.cli.test({
        yarnWorkspaces: true,
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
      console.log(result.getDisplayResults());
      t.match(
        result.getDisplayResults(),
        'Tested 10 projects, no vulnerable paths were found.',
        'Tested 10 projects',
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

      params.server.popRequests(6).forEach((req) => {
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
  },
};
