import sinon from 'sinon';
import { AcceptanceTests } from './cli-test.acceptance.test';

export const GoTests: AcceptanceTests = {
  language: 'Go',
  tests: {
    '`test golang-gomodules --file=go.mod`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'go.mod',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gomodules').returns(plugin);

      await params.cli.test('golang-gomodules', {
        file: 'go.mod',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'gomodules');
      t.equal(req.body.targetFile, 'go.mod', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'golang-gomodules',
          'go.mod',
          {
            args: null,
            file: 'go.mod',
            org: null,
            projectName: null,
            packageManager: 'gomodules',
            path: 'golang-gomodules',
            showVulnPaths: 'some',
          },
        ],
        'calls golang plugin',
      );
    },

    '`test golang-app` auto-detects golang-gomodules': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'go.mod',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gomodules').returns(plugin);

      await params.cli.test('golang-gomodules');
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'gomodules');
      t.equal(req.body.targetFile, 'go.mod', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'golang-gomodules',
          'go.mod',
          {
            args: null,
            file: 'go.mod',
            org: null,
            projectName: null,
            packageManager: 'gomodules',
            path: 'golang-gomodules',
            showVulnPaths: 'some',
          },
        ],
        'calls golang-gomodules plugin',
      );
    },

    '`test golang-app --file=Gopkg.lock`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'Gopkg.lock',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('golangdep').returns(plugin);

      await params.cli.test('golang-app', {
        file: 'Gopkg.lock',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
      t.equal(req.body.targetFile, 'Gopkg.lock', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'golang-app',
          'Gopkg.lock',
          {
            args: null,
            file: 'Gopkg.lock',
            org: null,
            projectName: null,
            packageManager: 'golangdep',
            path: 'golang-app',
            showVulnPaths: 'some',
          },
        ],
        'calls golang plugin',
      );
    },

    '`test golang-app --file=vendor/vendor.json`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'vendor/vendor.json',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('govendor').returns(plugin);

      await params.cli.test('golang-app', {
        file: 'vendor/vendor.json',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'govendor');
      t.equal(req.body.targetFile, 'vendor/vendor.json', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'golang-app',
          'vendor/vendor.json',
          {
            args: null,
            file: 'vendor/vendor.json',
            org: null,
            projectName: null,
            packageManager: 'govendor',
            path: 'golang-app',
            showVulnPaths: 'some',
          },
        ],
        'calls golang plugin',
      );
    },

    '`test golang-app` auto-detects golang/dep': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'testplugin',
              runtime: 'testruntime',
              targetFile: 'Gopkg.lock',
            },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('golangdep').returns(plugin);

      await params.cli.test('golang-app');
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'golangdep');
      t.equal(req.body.targetFile, 'Gopkg.lock', 'specifies target');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'golang-app',
          'Gopkg.lock',
          {
            args: null,
            file: 'Gopkg.lock',
            org: null,
            projectName: null,
            packageManager: 'golangdep',
            path: 'golang-app',
            showVulnPaths: 'some',
          },
        ],
        'calls golang plugin',
      );
    },

    '`test golang-app-govendor` auto-detects govendor': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            package: {},
            plugin: { name: 'testplugin', runtime: 'testruntime' },
          };
        },
      };
      const spyPlugin = sinon.spy(plugin, 'inspect');

      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('govendor').returns(plugin);

      await params.cli.test('golang-app-govendor');
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'govendor');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'golang-app-govendor',
          'vendor/vendor.json',
          {
            args: null,
            file: 'vendor/vendor.json',
            org: null,
            projectName: null,
            packageManager: 'govendor',
            path: 'golang-app-govendor',
            showVulnPaths: 'some',
          },
        ],
        'calls golang plugin',
      );
    },
  },
};
