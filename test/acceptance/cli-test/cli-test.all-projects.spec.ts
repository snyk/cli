import { AcceptanceTests } from './cli-test.acceptance.test';
import { getWorkspaceJSON } from '../workspace-helper';
import * as path from 'path';
import * as sinon from 'sinon';

export const AllProjectsTests: AcceptanceTests = {
  language: 'Mixed',
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
        detectionDepth: 1,
      });
      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(spyPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
      t.ok(spyPlugin.withArgs('maven').calledOnce, 'calls maven plugin');

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

    '`test --all-projects and --file payloads are the same`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      await params.cli.test('mono-repo-project', {
        allProjects: true,
        detectionDepth: 1,
      });
      const [
        rubyAllProjectsBody,
        npmAllProjectsBody,
        mavenAllProjectsBody,
      ] = params.server.popRequests(3).map((req) => req.body);

      await params.cli.test('mono-repo-project', {
        file: 'Gemfile.lock',
      });
      const { body: rubyFileBody } = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'package-lock.json',
      });
      const { body: npmFileBody } = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'pom.xml',
      });
      const { body: mavenFileBody } = params.server.popRequest();

      t.same(
        rubyAllProjectsBody,
        rubyFileBody,
        'Same body for --all-projects and --file=Gemfile.lock',
      );

      t.same(
        npmAllProjectsBody,
        npmFileBody,
        'Same body for --all-projects and --file=package-lock.json',
      );

      t.same(
        mavenAllProjectsBody,
        mavenFileBody,
        'Same body for --all-projects and --file=pom.xml',
      );
    },

    '`test maven-multi-app --all-projects --detection-depth=2`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const result = await params.cli.test('maven-multi-app', {
        allProjects: true,
        detectionDepth: 2,
      });

      t.ok(spyPlugin.withArgs('maven').calledTwice, 'calls maven plugin');
      t.ok(
        spyPlugin.withArgs('rubygems').notCalled,
        'did not call rubygems plugin',
      );
      t.ok(spyPlugin.withArgs('npm').notCalled, 'did not call npm plugin');
      params.server.popRequests(2).forEach((req) => {
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
          /maven/,
          'depGraph has package manager',
        );
      });
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
      t.match(
        result,
        `Target file:       simple-child${path.sep}pom.xml`,
        `contains target file simple-child${path.sep}pom.xml`,
      );
    },

    '`test large-mono-repo with --all-projects and --detection-depth=2`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);
      await params.cli.test('large-mono-repo', {
        allProjects: true,
        detectionDepth: 2,
      });
      t.equals(
        spyPlugin.withArgs('rubygems').callCount,
        1,
        'calls rubygems plugin once',
      );
      t.equals(
        spyPlugin.withArgs('npm').callCount,
        19,
        'calls npm plugin 19 times',
      );
      t.equals(
        spyPlugin.withArgs('maven').callCount,
        1,
        'calls maven plugin once',
      );
    },

    '`test large-mono-repo with --all-projects and --detection-depth=7`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);
      await params.cli.test('large-mono-repo', {
        allProjects: true,
        detectionDepth: 7,
      });
      t.equals(
        spyPlugin.withArgs('rubygems').callCount,
        19,
        'calls rubygems plugin 19 times',
      );
      t.equals(
        spyPlugin.withArgs('npm').callCount,
        19,
        'calls npm plugin 19 times',
      );
      t.equals(
        spyPlugin.withArgs('maven').callCount,
        6,
        'calls maven plugin 6 times',
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

      const res = await params.cli.test('ruby-app', { allProjects: true });

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
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.equal(req.query.ignorePolicy, 'true', 'should request ignore policy');
        const res = err.message;
        t.match(
          res,
          'Tested 7 dependencies for known vulnerabilities, found 5 vulnerabilities, 6 vulnerable paths.',
          'should display expected message',
        );
      }
    },

    '`test large-mono-repo with --all-projects, --detection-depth=7 and --exclude=bundler-app,maven-project-1`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);
      await params.cli.test('large-mono-repo', {
        allProjects: true,
        detectionDepth: 7,
        exclude: 'bundler-app,maven-project-1',
      });
      t.equals(
        spyPlugin.withArgs('rubygems').callCount,
        0,
        'does not call rubygems',
      );
      t.equals(
        spyPlugin.withArgs('npm').callCount,
        19,
        'calls npm plugin 19 times',
      );
      t.equals(
        spyPlugin.withArgs('maven').callCount,
        1,
        'calls maven plugin once, excluding the rest',
      );
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

    '`test monorepo-with-nuget --all-projects with Nuget, Python, Go, Npm, Cocoapods`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const mockPlugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'mock',
            },
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      // prevent plugin inspect from actually running (requires go to be installed)
      loadPlugin.withArgs('nuget').returns(mockPlugin);
      loadPlugin.withArgs('cocoapods').returns(mockPlugin);
      loadPlugin.withArgs('npm').returns(mockPlugin);
      loadPlugin.withArgs('golangdep').returns(mockPlugin);

      try {
        const res = await params.cli.test('monorepo-with-nuget', {
          allProjects: true,
          detectionDepth: 4,
        });
        t.equal(
          loadPlugin.withArgs('nuget').callCount,
          2,
          'calls nuget plugin twice',
        );
        t.ok(
          loadPlugin.withArgs('cocoapods').calledOnce,
          'calls cocoapods plugin',
        );
        t.ok(loadPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
        t.ok(
          loadPlugin.withArgs('golangdep').calledOnce,
          'calls golangdep plugin',
        );
        t.match(
          res,
          /Tested 5 projects, no vulnerable paths were found./,
          'Five projects tested',
        );
        t.match(
          res,
          `Target file:       src${path.sep}paymentservice${path.sep}package-lock.json`,
          'Npm project targetFile is as expected',
        );
        t.match(
          res,
          `Target file:       src${path.sep}cocoapods-app${path.sep}Podfile`,
          'Cocoapods project targetFile is as expected',
        );
        t.match(
          res,
          `Target file:       src${path.sep}frontend${path.sep}Gopkg.lock`,
          'Go dep project targetFile is as expected',
        );
        t.match(
          res,
          `Target file:       src${path.sep}cartservice-nuget${path.sep}obj${path.sep}project.assets.json`,
          'Nuget project targetFile is as expected',
        );
        t.match(
          res,
          `Target file:       test${path.sep}nuget-app-4${path.sep}packages.config`,
          'Nuget project targetFile is as expected',
        );
        t.match(res, 'Package manager:   nuget', 'Nuget package manager');
        t.match(
          res,
          'Package manager:   cocoapods',
          'Cocoapods package manager',
        );
        t.match(res, 'Package manager:   npm', 'Npm package manager');
        t.match(res, 'Package manager:   golangdep', 'Go dep package manager');
        t.match(
          res,
          'Package manager:   cocoapods',
          'Cocoapods package manager',
        );
      } catch (err) {
        t.fail('expected to pass');
      }
    },
    '`test composer-app --all-projects`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const result = await params.cli.test('composer-app', {
        allProjects: true,
      });

      t.ok(spyPlugin.withArgs('composer').calledOnce, 'calls composer plugin');

      params.server.popRequests(2).forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test', 'posts to correct url');
      });
      t.match(
        result,
        'Package manager:   composer',
        'contains package manager composer',
      );
      t.match(
        result,
        'Target file:       composer.lock',
        'contains target file composer.lock',
      );
    },
    '`test mono-repo-go --all-projects --detection-depth=2`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const mockPlugin = {
        async inspect() {
          return {
            package: {},
            plugin: {
              name: 'mock',
            },
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      // prevent plugin inspect from actually running (requires go to be installed)
      loadPlugin.withArgs('golangdep').returns(mockPlugin);
      loadPlugin.withArgs('gomodules').returns(mockPlugin);
      loadPlugin.withArgs('npm').returns(mockPlugin);
      loadPlugin.withArgs('govendor').returns(mockPlugin);

      const res = await params.cli.test('mono-repo-go', {
        allProjects: true,
        detectionDepth: 3,
      });
      t.ok(loadPlugin.withArgs('golangdep').calledOnce, 'calls go dep plugin');
      t.ok(loadPlugin.withArgs('gomodules').calledOnce, 'calls go mod plugin');
      t.ok(loadPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
      t.ok(
        loadPlugin.withArgs('govendor').calledOnce,
        'calls go vendor plugin',
      );
      t.match(
        res,
        /Tested 4 projects, no vulnerable paths were found./,
        'Four projects tested',
      );
      t.match(
        res,
        `Target file:       hello-dep${path.sep}Gopkg.lock`,
        'Go dep project targetFile is as expected',
      );
      t.match(
        res,
        `Target file:       hello-mod${path.sep}go.mod`,
        'Go mod project targetFile is as expected',
      );
      t.match(
        res,
        `Target file:       hello-node${path.sep}package-lock.json`,
        'Npm project targetFile is as expected',
      );
      t.match(
        res,
        `Target file:       hello-vendor${path.sep}vendor${path.sep}vendor.json`,
        'Go vendor project targetFile is as expected',
      );
      t.match(res, 'Package manager:   golangdep', 'Nuget package manager');
      t.match(res, 'Package manager:   gomodules', 'Nuget package manager');
      t.match(res, 'Package manager:   npm', 'Npm package manager');
      t.match(res, 'Package manager:   govendor', 'Go dep package manager');
    },
  },
};
