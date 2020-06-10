import { AcceptanceTests } from './cli-test.acceptance.test';

export const YarnTests: AcceptanceTests = {
  language: 'Yarn',
  tests: {
    // yarn lockfile based testing is only supported for node 4+
    '`test yarn-workspaces-out-of-sync --yarn-workspaces` out of sync fails': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('yarn-out-of-sync', { dev: true });
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
    },
    '`test yarn-workspaces-workspace-out-of-sync --yarn-workspaces --strict-out-of-sync=false` passes': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-workspaces-out-of-sync', {
        dev: true,
        strictOutOfSync: false,
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          // TODO: add packages
        ].sort(),
        'depGraph looks fine',
      );
    },

    '`test yarn-workspace --yarn-workspaces --dev` sends pkg info': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-workspace', {
        yanrWorkspaces: true,
        dev: true,
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          // TODO: add packages
        ].sort(),
        'depGraph looks fine',
      );
    },
    '`test` on a yarn workspace does work and displays appropriate text': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces('yarn-workspace');
      await params.cli.test();
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          // TODO: add packages
        ].sort(),
        'depGraph looks fine',
      );
    },
  },
};
