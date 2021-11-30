import sinon from 'sinon';
import { AcceptanceTests } from './cli-test.acceptance.test';
import depGraphLib from '@snyk/dep-graph';

export const ElixirTests: AcceptanceTests = {
  language: 'Elixir',
  tests: {
    '`test elixir --file=mix.exs`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            scannedProjects: await getScannedProjects(),
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'mix.exs',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('hex').returns(plugin);

      await params.cli.test('elixir-hex', {
        file: 'mix.exs',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'hex');
      t.equal(req.body.targetFile, 'mix.exs', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'elixir-hex',
          'mix.exs',
          {
            args: null,
            file: 'mix.exs',
            org: null,
            projectName: null,
            packageManager: 'hex',
            path: 'elixir-hex',
            showVulnPaths: 'some',
          },
        ],
        'calls golang plugin',
      );
    },

    '`test elixir-hex` auto-detects hex': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            scannedProjects: await getScannedProjects(),
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'mix.exs',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('hex').returns(plugin);

      await params.cli.test('elixir-hex');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'hex');
      t.equal(req.body.targetFile, 'mix.exs', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'elixir-hex',
          'mix.exs',
          {
            args: null,
            file: 'mix.exs',
            org: null,
            projectName: null,
            packageManager: 'hex',
            path: 'elixir-hex',
            showVulnPaths: 'some',
          },
        ],
        'calls elixir-hex plugin',
      );
    },
  },
};

async function getScannedProjects() {
  return [
    {
      packageManager: 'hex',
      targetFile: 'mix.exs',
      depGraph: await depGraphLib.createFromJSON({
        schemaVersion: '1.2.0',
        pkgManager: {
          name: 'hex',
        },
        pkgs: [
          {
            id: 'snowflex@0.3.1',
            info: {
              name: 'snowflex',
              version: '0.3.1',
            },
          },
        ],
        graph: {
          rootNodeId: 'root-node',
          nodes: [
            {
              nodeId: 'root-node',
              pkgId: 'snowflex@0.3.1',
              deps: [],
            },
          ],
        },
      }),
    },
  ];
}
