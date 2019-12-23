import { AcceptanceTests } from './cli-test.acceptance.test';
import { getWorkspaceJSON } from '../workspace-helper';
import * as sinon from 'sinon';

export const AllProjectsTests: AcceptanceTests = {
  language: 'Mixed (Ruby & Npm)',
  tests: {
    '`test mono-repo-project with lockfiles --all-projects`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const result = await params.cli.test('mono-repo-project', {
        allProjects: true,
        detectionLevel: 1,
      });
      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(spyPlugin.withArgs('npm').calledOnce, 'calls npm plugin');

      params.server.popRequests(3).forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
        t.ok(req.body.depGraph, 'body contains depGraph');
        t.match(
          req.body.depGraph.pkgManager.name,
          /(npm|rubygems|maven)/,
          'depGraph has package manager',
        );
      });
      // results should contain test results from both package managers
      t.match(
        result,
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        result,
        'Target file:       Gemfile.lock',
        'contains target file Gemfile.lock',
      );
      t.match(
        result,
        'Project name:      shallow-goof',
        'contains correct project name for npm',
      );
      t.match(result, 'Package manager:   npm', 'contains package manager npm');
      t.match(
        result,
        'Target file:       package-lock.json',
        'contains target file package-lock.json',
      );
      t.match(
        result,
        'Package manager:   maven',
        'contains package manager maven',
      );
      t.match(
        result,
        'Target file:       pom.xml',
        'contains target file pom.xml',
      );
    },

    '`test mono-repo-project-manifests-only --all-projects`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const result = await params.cli.test('mono-repo-project-manifests-only', {
        allProjects: true,
      });
      params.server.popRequests(3).forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
        t.ok(req.body.depGraph, 'body contains depGraph');
        t.match(
          req.body.depGraph.pkgManager.name,
          /(npm|rubygems|maven)/,
          'depGraph has package manager',
        );
      });

      // results should contain test results from all package managers
      t.match(
        result,
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        result,
        'Target file:       Gemfile.lock',
        'contains target file Gemfile.lock',
      );
      t.match(result, 'Package manager:   npm', 'contains package manager npm');
      t.match(
        result,
        'Target file:       package-lock.json',
        'contains target file package-lock.json',
      );
      t.match(
        result,
        'Package manager:   maven',
        'contains package manager maven',
      );
      t.match(
        result,
        'Target file:       pom.xml',
        'contains target file pom.xml',
      );
    },

    '`test ruby-app --all-projects`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const res = await params.cli.test('ruby-app', {
        allProjects: true,
        detectionLevel: 1,
      });

      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.notOk(spyPlugin.withArgs('npm').calledOnce, "doesn't call npm plugin");
      t.notOk(
        spyPlugin.withArgs('maven').calledOnce,
        "doesn't call maven plugin",
      );

      t.match(
        res,
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        res,
        'Target file:       Gemfile.lock',
        'contains target file Gemfile.lock',
      );
    },

    '`test ruby-app-thresholds --all-projects --ignore-policy`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces('ruby-app-thresholds');
      params.server.setNextResponse(
        getWorkspaceJSON(
          'ruby-app-thresholds',
          'test-graph-result-medium-severity.json',
        ),
      );
      try {
        await params.cli.test('./', {
          'ignore-policy': true,
          allProjects: true,
          detectionLevel: 1,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.equal(req.query.ignorePolicy, 'true');
        const res = err.message;
        t.match(
          res,
          'Tested 7 dependencies for known vulnerabilities, found 5 vulnerabilities, 6 vulnerable paths.',
          'should display expected message',
        );
      }
    },

    '`test empty --all-projects`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('empty', {
          allProjects: true,
        });
        t.fail('expected an error to be thrown');
      } catch (err) {
        const res = err.message;
        t.match(
          res,
          'Could not detect supported target files',
          'should display expected message',
        );
      }
    },
  },
};
