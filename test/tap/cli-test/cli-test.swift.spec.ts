import { AcceptanceTests } from '../cli-test.acceptance.test';

export const SwiftTests: AcceptanceTests = {
  language: 'Swift',
  tests: {
    '`test swift-app (autodetect)`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      await params.cli.test('swift-app');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');

      const depGraph = req.body.depGraph;
      t.equal(depGraph.pkgManager.name, 'swift');
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'github.com/apple/swift-protobuf@1.20.3',
          'github.com/grpc/grpc-swift@1.0.0',
          'github.com/apple/swift-nio@2.45.0',
          'github.com/apple/swift-nio-transport-services@1.15.0',
          'github.com/apple/swift-nio-ssl@2.23.0',
          'github.com/apple/swift-nio-http2@1.23.1',
          'github.com/apple/swift-nio-extras@1.15.0',
          'github.com/apple/swift-log@1.4.4',
          'github.com/apple/swift-collections@1.0.4',
          'github.com/apple/swift-atomics@1.0.3',
          'swift-app@unspecified',
        ].sort(),
        'depGraph looks fine',
      );
    },
  },
};
