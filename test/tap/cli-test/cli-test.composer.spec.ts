import * as sinon from 'sinon';

import { AcceptanceTests } from '../cli-test.acceptance.test';

export const ComposerTests: AcceptanceTests = {
  language: 'Composer',
  tests: {
    '`test composer-app --file=composer.lock`': (params, utils) => async (
      t,
    ) => {
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
      loadPlugin.withArgs('composer').returns(plugin);

      await params.cli.test('composer-app', {
        file: 'composer.lock',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'composer');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'composer-app',
          'composer.lock',
          {
            args: null,
            file: 'composer.lock',
            org: null,
            projectName: null,
            packageManager: 'composer',
            path: 'composer-app',
            showVulnPaths: 'some',
          },
        ],
        'calls composer plugin',
      );
    },

    '`test composer-app` auto-detects composer.lock': (params, utils) => async (
      t,
    ) => {
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
      loadPlugin.withArgs('composer').returns(plugin);

      await params.cli.test('composer-app');
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'composer');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'composer-app',
          'composer.lock',
          {
            args: null,
            file: 'composer.lock',
            org: null,
            projectName: null,
            packageManager: 'composer',
            path: 'composer-app',
            showVulnPaths: 'some',
          },
        ],
        'calls composer plugin',
      );
    },

    '`test composer-app --file=composer.lock --dev`': (params, utils) => async (
      t,
    ) => {
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
      loadPlugin.withArgs('composer').returns(plugin);

      await params.cli.test('composer-app', {
        file: 'composer.lock',
        dev: true,
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'composer');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'composer-app',
          'composer.lock',
          {
            args: null,
            dev: true,
            file: 'composer.lock',
            org: null,
            projectName: null,
            packageManager: 'composer',
            path: 'composer-app',
            showVulnPaths: 'some',
          },
        ],
        'calls composer plugin',
      );
    },

    '`test composer-app golang-app nuget-app` auto-detects all three projects': (
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
      loadPlugin.withArgs('composer').returns(plugin);
      loadPlugin.withArgs('golangdep').returns(plugin);
      loadPlugin.withArgs('nuget').returns(plugin);

      await params.cli.test('composer-app', 'golang-app', 'nuget-app', {
        org: 'test-org',
      });
      // assert three API calls made
      const reqs = params.server
        .getRequests()
        .filter((r) => r.url === '/api/v1/test-dep-graph?org=test-org');

      t.same(
        reqs.map((r) => r.method),
        ['POST', 'POST', 'POST'],
        'all post requests',
      );

      t.same(
        reqs.map((r) => r.headers['x-snyk-cli-version']),
        [params.versionNumber, params.versionNumber, params.versionNumber],
        'all send version number',
      );

      t.equal(reqs.length, 3, 'all urls are present');

      t.same(
        reqs.map((r) => r.body.depGraph.pkgManager.name).sort(),
        ['composer', 'golangdep', 'nuget'],
        'all urls are present',
      );

      // assert three spyPlugin calls, each with a different app
      const calls = spyPlugin.getCalls().sort((call1: any, call2: any) => {
        return call1.args[0] < call2.args[1]
          ? -1
          : call1.args[0] > call2.args[0]
          ? 1
          : 0;
      });
      t.same(
        calls[0].args,
        [
          'composer-app',
          'composer.lock',
          {
            args: null,
            org: 'test-org',
            file: 'composer.lock',
            projectName: null,
            packageManager: 'composer',
            path: 'composer-app',
            showVulnPaths: 'some',
          },
        ],
        'calls composer plugin',
      );
      t.same(
        calls[1].args,
        [
          'golang-app',
          'Gopkg.lock',
          {
            args: null,
            org: 'test-org',
            file: 'Gopkg.lock',
            projectName: null,
            packageManager: 'golangdep',
            path: 'golang-app',
            showVulnPaths: 'some',
          },
        ],
        'calls golangdep plugin',
      );
      t.same(
        calls[2].args,
        [
          'nuget-app',
          'project.assets.json',
          {
            args: null,
            org: 'test-org',
            file: 'project.assets.json',
            projectName: null,
            packageManager: 'nuget',
            path: 'nuget-app',
            showVulnPaths: 'some',
          },
        ],
        'calls nuget plugin',
      );
    },
  },
};
