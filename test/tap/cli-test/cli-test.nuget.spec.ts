import * as sinon from 'sinon';
import { AcceptanceTests } from '../cli-test.acceptance.test';

export const NugetTests: AcceptanceTests = {
  language: 'Nuget',
  tests: {
    '`test nuget-app --file=non_existent`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('nuget-app', { file: 'non-existent' });
        t.fail('should have failed');
      } catch (err) {
        t.pass('throws err');
        t.match(
          err.message,
          'Could not find the specified file: non-existent',
          'show first part of err message',
        );
        t.match(
          err.message,
          'Please check that it exists and try again.',
          'show second part of err message',
        );
      }
    },

    '`test nuget-app-2 auto-detects project.assets.json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'project.assets.json',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('nuget-app-2');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'nuget');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'nuget-app-2',
          'project.assets.json',
          {
            args: null,
            file: 'project.assets.json',
            org: null,
            projectName: null,
            packageManager: 'nuget',
            path: 'nuget-app-2',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test nuget-app-2.1 auto-detects obj/project.assets.json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'obj/project.assets.json',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('nuget-app-2.1');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'nuget');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'nuget-app-2.1',
          'obj/project.assets.json',
          {
            args: null,
            file: 'obj/project.assets.json',
            org: null,
            projectName: null,
            packageManager: 'nuget',
            path: 'nuget-app-2.1',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test nuget-app-4 auto-detects packages.config`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'paket.dependencies',
              targetRuntime: 'net465s',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('nuget-app-4');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'nuget');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'nuget-app-4',
          'packages.config',
          {
            args: null,
            file: 'packages.config',
            org: null,
            projectName: null,
            packageManager: 'nuget',
            path: 'nuget-app-4',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test nuget-app --file=project.assets.json`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'project.assets.json',
              targetRuntime: 'net465s',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('nuget-app', {
        file: 'project.assets.json',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.targetFile, 'project.assets.json', 'specifies target');
      t.equal(req.body.depGraph.pkgManager.name, 'nuget');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'nuget-app',
          'project.assets.json',
          {
            args: null,
            file: 'project.assets.json',
            org: null,
            projectName: null,
            packageManager: 'nuget',
            path: 'nuget-app',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test nuget-app --file=packages.config`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'packages.config',
              targetRuntime: 'net465s',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('nuget-app', {
        file: 'packages.config',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.targetFile, 'packages.config', 'specifies target');
      t.equal(req.body.depGraph.pkgManager.name, 'nuget');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'nuget-app',
          'packages.config',
          {
            args: null,
            file: 'packages.config',
            org: null,
            projectName: null,
            packageManager: 'nuget',
            path: 'nuget-app',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test nuget-app --file=project.json`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'project.json',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('nuget-app', {
        file: 'project.json',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.targetFile, 'project.json', 'specifies target');
      t.equal(req.body.depGraph.pkgManager.name, 'nuget');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'nuget-app',
          'project.json',
          {
            args: null,
            file: 'project.json',
            org: null,
            projectName: null,
            packageManager: 'nuget',
            path: 'nuget-app',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test paket-app auto-detects paket.dependencies`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'paket.dependencies',
              targetRuntime: 'net465s',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('paket').returns(plugin);

      await params.cli.test('paket-app');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'paket');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'paket-app',
          'paket.dependencies',
          {
            args: null,
            file: 'paket.dependencies',
            org: null,
            projectName: null,
            packageManager: 'paket',
            path: 'paket-app',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test paket-obj-app auto-detects obj/project.assets.json if exists`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'paket.dependencies',
              targetRuntime: 'net465s',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('paket-obj-app');

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'nuget');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'paket-obj-app',
          'obj/project.assets.json',
          {
            args: null,
            file: 'obj/project.assets.json',
            org: null,
            projectName: null,
            packageManager: 'nuget',
            path: 'paket-obj-app',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },

    '`test paket-app --file=paket.dependencies`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'snyk-nuget-plugin',
              targetFile: 'paket.dependencies',
              targetRuntime: 'net465s',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('paket').returns(plugin);

      await params.cli.test('paket-app', {
        file: 'paket.dependencies',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'paket');
      t.equal(req.body.targetFile, 'paket.dependencies', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'paket-app',
          'paket.dependencies',
          {
            args: null,
            file: 'paket.dependencies',
            org: null,
            projectName: null,
            packageManager: 'paket',
            path: 'paket-app',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },
  },
};
