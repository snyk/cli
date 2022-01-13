import { AcceptanceTests } from '../cli-test.acceptance.test';

export const CocoapodsTests: AcceptanceTests = {
  language: 'Cocoapods',
  tests: {
    '`test cocoapods-app (autodetect)`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      await params.cli.test('cocoapods-app');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');

      const depGraph = req.body.depGraph;
      t.equal(depGraph.pkgManager.name, 'cocoapods');
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['cocoapods-app@0.0.0', 'Reachability@3.1.0'].sort(),
        'depGraph looks fine',
      );
    },
  },
};
