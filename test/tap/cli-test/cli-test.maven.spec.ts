import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as subProcess from '../../../src/lib/sub-process';

import { AcceptanceTests } from '../cli-test.acceptance.test';
import * as depGraphLib from '@snyk/dep-graph';

/**
 * We can't expect all test environments to have Maven installed
 * So, hijack the system exec call and return the expected output
 */
function stubExec(t, execOutputFile) {
  const stub = sinon.stub(subProcess, 'execute').callsFake(() => {
    const stdout = fs.readFileSync(path.join(execOutputFile), 'utf8');
    return Promise.resolve(stdout);
  });
  t.teardown(() => {
    stub.restore();
  });
}

export const MavenTests: AcceptanceTests = {
  language: 'Maven',
  tests: {
    '`test maven-app --file=pom.xml --dev` sends package info': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      stubExec(t, 'maven-app/mvn-dep-tree-stdout.txt');
      await params.cli.test('maven-app', {
        file: 'pom.xml',
        org: 'nobelprize.org',
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
      t.equal(
        req.query.org,
        'nobelprize.org',
        'org sent as a query in request',
      );
      t.match(req.body.targetFile, undefined, 'target is undefined');

      const depGraph = depGraphLib.createFromJSON(req.body.depGraph);
      t.equal(
        depGraph.rootPkg.name,
        'com.mycompany.app:maven-app',
        'root name',
      );
      const pkgs = depGraph.getPkgs().map((x) => `${x.name}@${x.version}`);
      t.ok(pkgs.indexOf('com.mycompany.app:maven-app@1.0-SNAPSHOT') >= 0);
      t.ok(pkgs.indexOf('axis:axis@1.4') >= 0);
      t.ok(pkgs.indexOf('junit:junit@3.8.2') >= 0);
    },

    '`test maven-app-with-jars --file=example.jar` sends package info': (
      params,
      utils,
      config,
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
      loadPlugin.withArgs('maven').returns(plugin);

      await params.cli.test('maven-app-with-jars', {
        file: 'example.jar',
      });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');

      t.equal(req.body.depGraph.pkgManager.name, 'maven');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'maven-app-with-jars',
          'example.jar',
          {
            args: null,
            file: 'example.jar',
            org: null,
            projectName: null,
            packageManager: 'maven',
            path: 'maven-app-with-jars',
            showVulnPaths: 'some',
          },
          config,
        ],
        'calls mvn plugin',
      );
    },

    '`test maven-app-with-jars --file=example.war` sends package info': (
      params,
      utils,
      config,
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
      loadPlugin.withArgs('maven').returns(plugin);

      await params.cli.test('maven-app-with-jars', {
        file: 'example.war',
      });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');

      t.equal(req.body.depGraph.pkgManager.name, 'maven');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'maven-app-with-jars',
          'example.war',
          {
            args: null,
            file: 'example.war',
            org: null,
            projectName: null,
            packageManager: 'maven',
            path: 'maven-app-with-jars',
            showVulnPaths: 'some',
          },
          config,
        ],
        'calls mvn plugin',
      );
    },

    '`test maven-app-with-jars --scan-all-unmanaged` sends package info': (
      params,
      utils,
      config,
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
      loadPlugin.withArgs('maven').returns(plugin);
      await params.cli.test('maven-app-with-jars', {
        scanAllUnmanaged: true,
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      t.equal(req.body.depGraph.pkgManager.name, 'maven');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'maven-app-with-jars',
          undefined, // no specified target file
          {
            args: null,
            // file: undefined, no file
            org: null,
            projectName: null,
            packageManager: 'maven',
            path: 'maven-app-with-jars',
            showVulnPaths: 'some',
            scanAllUnmanaged: true,
          },
          config,
        ],
        'calls mvn plugin',
      );
    },
  },
};
