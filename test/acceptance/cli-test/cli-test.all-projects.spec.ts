import * as path from 'path';
import * as sinon from 'sinon';
import * as depGraphLib from '@snyk/dep-graph';
import { CommandResult } from '../../../src/cli/commands/types';
import { AcceptanceTests } from './cli-test.acceptance.test';
import { getWorkspaceJSON } from '../workspace-helper';

const simpleGradleGraph = depGraphLib.createFromJSON({
  schemaVersion: '1.2.0',
  pkgManager: {
    name: 'gradle',
  },
  pkgs: [
    {
      id: 'gradle-monorepo@0.0.0',
      info: {
        name: 'gradle-monorepo',
        version: '0.0.0',
      },
    },
  ],
  graph: {
    rootNodeId: 'root-node',
    nodes: [
      {
        nodeId: 'root-node',
        pkgId: 'gradle-monorepo@0.0.0',
        deps: [],
      },
    ],
  },
});

export const AllProjectsTests: AcceptanceTests = {
  language: 'Mixed',
  tests: {
    '`test gradle-with-orphaned-build-file --all-projects` warns user': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            plugin: {
              name: 'bundled:gradle',
              runtime: 'unknown',
              meta: {},
            },
            scannedProjects: [
              {
                meta: {
                  gradleProjectName: 'root-proj',
                  versionBuildInfo: {
                    gradleVersion: '6.5',
                  },
                  targetFile: 'build.gradle',
                },
                depGraph: simpleGradleGraph,
              },
              {
                meta: {
                  gradleProjectName: 'root-proj/subproj',
                  versionBuildInfo: {
                    gradleVersion: '6.5',
                  },
                  targetFile: 'subproj/build.gradle',
                },
                depGraph: simpleGradleGraph,
              },
            ],
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gradle').returns(plugin);
      loadPlugin.callThrough();
      // read data from console.log
      let stdoutMessages = '';
      const stubConsoleLog = (msg: string) => (stdoutMessages += msg);
      const stubbedConsole = sinon
        .stub(console, 'warn')
        .callsFake(stubConsoleLog);
      const result: CommandResult = await params.cli.test(
        'gradle-with-orphaned-build-file',
        {
          allProjects: true,
          detectionDepth: 3,
        },
      );
      t.same(
        stdoutMessages,
        '✗ 1/3 detected Gradle manifests did not return dependencies. ' +
          'They may have errored or were not included as part of a multi-project build. You may need to scan them individually with --file=path/to/file. Run with `-d` for more info.',
      );
      stubbedConsole.restore();
      t.ok(stubbedConsole.calledOnce);
      t.ok(loadPlugin.withArgs('gradle').calledOnce, 'calls gradle plugin');

      t.match(
        result.getDisplayResults(),
        'Tested 2 projects',
        'Detected 2 projects',
      );
    },
    '`test kotlin-monorepo --all-projects` scans kotlin files': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const plugin = {
        async inspect() {
          return {
            plugin: {
              name: 'bundled:gradle',
              runtime: 'unknown',
              meta: {},
            },
            scannedProjects: [
              {
                meta: {
                  gradleProjectName: 'root-proj',
                  versionBuildInfo: {
                    gradleVersion: '6.5',
                  },
                },
                depGraph: simpleGradleGraph,
              },
              {
                meta: {
                  gradleProjectName: 'root-proj/subproj',
                  versionBuildInfo: {
                    gradleVersion: '6.5',
                  },
                },
                depGraph: simpleGradleGraph,
              },
            ],
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('gradle').returns(plugin);
      loadPlugin.callThrough();

      const result: CommandResult = await params.cli.test('kotlin-monorepo', {
        allProjects: true,
        detectionDepth: 3,
      });
      t.ok(loadPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(loadPlugin.withArgs('gradle').calledOnce, 'calls gradle plugin');

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
          /(gradle|rubygems)/,
          'depGraph has package manager',
        );
      });
      t.match(
        result.getDisplayResults(),
        'Tested 3 projects',
        'Detected 3 projects',
      );
      t.match(
        result.getDisplayResults(),
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        result.getDisplayResults(),
        'Package manager:   gradle',
        'contains package manager gradle',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       Gemfile.lock',
        'contains target file Gemfile.lock',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       build.gradle.kts',
        'contains target file build.gradle.kts',
      );
    },
    '`test yarn-out-of-sync` out of sync fails': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('yarn-workspace-out-of-sync', {
          allProjects: true,
        });
        t.fail('Should fail');
      } catch (e) {
        t.equal(
          e.message,
          '\nTesting yarn-workspace-out-of-sync...\n\nFailed to get dependencies for all 3 potential projects. Run with `-d` for debug output and contact support@snyk.io',
          'Contains enough info about err',
        );
      }
    },
    '`test mono-repo-with-ignores --all-projects` respects .snyk policy': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);

      const result: CommandResult = await params.cli.test(
        'mono-repo-with-ignores',
        {
          allProjects: true,
          detectionDepth: 3,
        },
      );
      t.ok(loadPlugin.withArgs('npm').calledTwice, 'calls npm plugin');
      let policyCount = 0;
      params.server.popRequests(2).forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
        t.ok(req.body.depGraph, 'body contains depGraph');
        const vulnerableFolderPath =
          process.platform === 'win32'
            ? 'vulnerable\\package-lock.json'
            : 'vulnerable/package-lock.json';
        if (req.body.targetFileRelativePath.endsWith(vulnerableFolderPath)) {
          t.match(
            req.body.policy,
            'npm:node-uuid:20160328',
            'body contains policy',
          );
          policyCount += 1;
        }
        t.match(
          req.body.depGraph.pkgManager.name,
          /(npm)/,
          'depGraph has package manager',
        );
      });

      t.match(policyCount, 1, 'one policy should have been found');
      // results should contain test results from both package managers
      // and show only 1/2 vulnerable paths for nested one since we ignore
      // it in the .snyk file

      t.match(
        result.getDisplayResults(),
        'Package manager:   npm',
        'contains package manager npm',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       package-lock.json',
        'contains target file package-lock.json',
      );
    },
    '`test mono-repo-project with lockfiles --all-projects`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      // mock python plugin because CI tooling doesn't have pipenv installed
      const mockPlugin = {
        async inspect() {
          return {
            plugin: {
              targetFile: 'Pipfile',
              name: 'snyk-python-plugin',
            },
            package: {},
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('pip').returns(mockPlugin);
      loadPlugin.callThrough(); // don't mock other plugins

      const result: CommandResult = await params.cli.test('mono-repo-project', {
        allProjects: true,
        detectionDepth: 1,
        skipUnresolved: true,
      });
      t.ok(loadPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(loadPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
      t.ok(loadPlugin.withArgs('maven').calledOnce, 'calls maven plugin');
      t.ok(loadPlugin.withArgs('nuget').calledOnce, 'calls nuget plugin');
      t.ok(loadPlugin.withArgs('paket').calledOnce, 'calls nuget plugin');
      t.ok(loadPlugin.withArgs('pip').calledOnce, 'calls pip plugin');
      t.ok(loadPlugin.withArgs('sbt').calledOnce, 'calls pip plugin');

      params.server.popRequests(7).forEach((req) => {
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
          /(npm|rubygems|maven|nuget|paket|pip|sbt)/,
          'depGraph has package manager',
        );
      });
      // results should contain test results from both package managers

      t.match(
        result.getDisplayResults(),
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       Gemfile.lock',
        'contains target file Gemfile.lock',
      );
      t.match(
        result.getDisplayResults(),
        'Project name:      shallow-goof',
        'contains correct project name for npm',
      );
      t.match(
        result.getDisplayResults(),
        'Package manager:   npm',
        'contains package manager npm',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       package-lock.json',
        'contains target file package-lock.json',
      );
      t.match(
        result.getDisplayResults(),
        'Package manager:   maven',
        'contains package manager maven',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       pom.xml',
        'contains target file pom.xml',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       Pipfile',
        'contains target file Pipfile',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       build.sbt',
        'contains target file build.sbt',
      );
    },

    '`test mono-repo-project --all-projects --detection-depth=3`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      // mock python plugin becuase CI tooling doesn't have pipenv installed
      const mockPipfile = {
        async inspect() {
          return {
            plugin: {
              targetFile: 'Pipfile',
              name: 'snyk-python-plugin',
            },
            package: {},
          };
        },
      };
      const mockRequirements = {
        async inspect() {
          return {
            plugin: {
              targetFile: 'python-app-with-req-file/requirements.txt',
              name: 'snyk-python-plugin',
            },
            package: {},
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      // detect pip plugin called only with Pipfile (and not requirement.txt)
      loadPlugin
        .withArgs('pip', sinon.match.has('file', 'Pipfile'))
        .returns(mockPipfile)
        .withArgs(
          'pip',
          sinon.match.has('file', 'python-app-with-req-file/requirements.txt'),
        )
        .returns(mockRequirements);
      loadPlugin.callThrough(); // don't mock other plugins

      const result: CommandResult = await params.cli.test('mono-repo-project', {
        allProjects: true,
        detectionDepth: 3,
        allowMissing: true, // allow requirements.txt to pass when deps not installed
      });

      t.equals(
        loadPlugin.withArgs('rubygems').callCount,
        2,
        'calls rubygems plugin',
      );
      t.equals(loadPlugin.withArgs('npm').callCount, 2, 'calls npm plugin');
      t.ok(loadPlugin.withArgs('maven').calledOnce, 'calls maven plugin');
      t.ok(loadPlugin.withArgs('nuget').calledOnce, 'calls nuget plugin');
      t.ok(loadPlugin.withArgs('paket').calledOnce, 'calls nuget plugin');
      t.ok(loadPlugin.withArgs('sbt').calledOnce, 'calls sbt plugin');
      t.equals(loadPlugin.withArgs('pip').callCount, 2, 'calls pip plugin');

      // Why are we triggering gradle here?
      params.server.popRequests(10).forEach((req) => {
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
          /(npm|rubygems|maven|nuget|paket|pip|sbt)/,
          'depGraph has package manager',
        );
      });

      // ruby
      t.match(
        result.getDisplayResults(),
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       Gemfile.lock',
        'contains target file Gemfile.lock',
      );
      t.match(
        result.getDisplayResults(),
        `Target file:       bundler-app${path.sep}Gemfile.lock`,
        `contains target file bundler-app${path.sep}Gemfile.lock`,
      );

      // npm
      t.match(
        result.getDisplayResults(),
        'Project name:      shallow-goof',
        'contains correct project name for npm',
      );
      t.match(
        result.getDisplayResults(),
        'Project name:      goof',
        'contains correct project name for npm',
      );
      t.match(
        result.getDisplayResults(),
        'Package manager:   npm',
        'contains package manager npm',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       package-lock.json',
        'contains target file package-lock.json',
      );
      t.match(
        result.getDisplayResults(),
        `Target file:       npm-project${path.sep}package.json`,
        `contains target file npm-project${path.sep}package.json`,
      );

      // maven
      t.match(
        result.getDisplayResults(),
        'Package manager:   maven',
        'contains package manager maven',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       pom.xml',
        'contains target file pom.xml',
      );

      // nuget
      t.match(
        result.getDisplayResults(),
        'Package manager:   nuget',
        'contains package manager nuget',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       packages.config',
        'contains target file packages.config',
      );

      // paket
      t.match(
        result.getDisplayResults(),
        'Package manager:   paket',
        'contains package manager paket',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       paket.dependencies',
        'contains target file paket.dependencies',
      );

      // pip
      t.match(
        result.getDisplayResults(),
        'Package manager:   pip',
        'contains package manager pip',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       Pipfile',
        'contains target file Pipfile',
      );
      t.match(
        result.getDisplayResults(),
        `Target file:       python-app-with-req-file${path.sep}requirements.txt`,
        `contains target file python-app-with-req-file${path.sep}requirements.txt`,
      );

      // sbt
      t.match(
        result.getDisplayResults(),
        'Target file:       build.sbt',
        'contains target file build.sbt',
      );
    },

    '`test mono-repo-project --all-projects and --file payloads are the same`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      // mock python plugin becuase CI tooling doesn't have pipenv installed
      const mockPlugin = {
        async inspect() {
          return {
            plugin: {
              targetFile: 'Pipfile',
              name: 'snyk-python-plugin',
            },
            package: {},
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      t.teardown(loadPlugin.restore);
      loadPlugin.withArgs('pip').returns(mockPlugin);
      loadPlugin.callThrough(); // don't mock other plugins

      await params.cli.test('mono-repo-project', {
        allProjects: true,
        detectionDepth: 1,
      });

      const requests = params.server.popRequests(7);

      // find each type of request
      const rubyAll = requests.find(
        (req) => req.body.depGraph.pkgManager.name === 'rubygems',
      );
      const pipAll = requests.find(
        (req) => req.body.depGraph.pkgManager.name === 'pip',
      );
      const npmAll = requests.find(
        (req) => req.body.depGraph.pkgManager.name === 'npm',
      );
      const nugetAll = requests.find(
        (req) => req.body.depGraph.pkgManager.name === 'nuget',
      );
      const paketAll = requests.find(
        (req) => req.body.depGraph.pkgManager.name === 'paket',
      );
      const mavenAll = requests.find(
        (req) => req.body.depGraph.pkgManager.name === 'maven',
      );
      const sbtAll = requests.find(
        (req) => req.body.depGraph.pkgManager.name === 'sbt',
      );

      await params.cli.test('mono-repo-project', {
        file: 'Gemfile.lock',
      });
      const rubyFile = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'Pipfile',
      });
      const pipFile = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'paket.dependencies',
      });
      const paketFile = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'packages.config',
      });
      const nugetFile = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'package-lock.json',
      });
      const npmFile = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'pom.xml',
      });
      const mavenFile = params.server.popRequest();

      await params.cli.test('mono-repo-project', {
        file: 'build.sbt',
      });
      const sbtFile = params.server.popRequest();

      t.same(
        pipAll.body,
        pipFile.body,
        'Same body for --all-projects and --file=Pipfile',
      );

      t.same(
        rubyAll.body,
        rubyFile.body,
        'Same body for --all-projects and --file=Gemfile.lock',
      );

      t.same(
        npmAll.body,
        npmFile.body,
        'Same body for --all-projects and --file=package-lock.json',
      );

      t.same(
        paketAll.body,
        paketFile.body,
        'Same body for --all-projects and --file=package-lock.json',
      );

      t.same(
        nugetAll.body,
        nugetFile.body,
        'Same body for --all-projects and --file=package-lock.json',
      );
      t.same(
        mavenAll.body,
        mavenFile.body,
        'Same body for --all-projects and --file=pom.xml',
      );

      t.same(
        sbtAll.body,
        sbtFile.body,
        'Same body for --all-projects and --file=build.sbt',
      );
    },

    '`test maven-multi-app --all-projects --detection-depth=2`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const result: CommandResult = await params.cli.test('maven-multi-app', {
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
        result.getDisplayResults(),
        'Package manager:   maven',
        'contains package manager maven',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       pom.xml',
        'contains target file pom.xml',
      );
      t.match(
        result.getDisplayResults(),
        `Target file:       simple-child${path.sep}pom.xml`,
        `contains target file simple-child${path.sep}pom.xml`,
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
        spyPlugin.withArgs('gradle').callCount,
        2,
        'calls gradle plugin 2 times',
      );
      t.equals(
        spyPlugin.withArgs('gradle').args[0][1].allSubProjects,
        true,
        'calls gradle plugin with allSubProjects property',
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
      const result: CommandResult = await params.cli.test(
        'mono-repo-project-manifests-only',
        {
          allProjects: true,
        },
      );
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
        result.getDisplayResults(),
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       Gemfile.lock',
        'contains target file Gemfile.lock',
      );
      t.match(
        result.getDisplayResults(),
        'Package manager:   npm',
        'contains package manager npm',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       package-lock.json',
        'contains target file package-lock.json',
      );
      t.match(
        result.getDisplayResults(),
        'Package manager:   maven',
        'contains package manager maven',
      );
      t.match(
        result.getDisplayResults(),
        'Target file:       pom.xml',
        'contains target file pom.xml',
      );
    },

    '`test ruby-app --all-projects`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const res: CommandResult = await params.cli.test('ruby-app', {
        allProjects: true,
      });

      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.notOk(spyPlugin.withArgs('npm').calledOnce, "doesn't call npm plugin");
      t.notOk(
        spyPlugin.withArgs('maven').calledOnce,
        "doesn't call maven plugin",
      );

      t.match(
        res.getDisplayResults(),
        'Package manager:   rubygems',
        'contains package manager rubygems',
      );
      t.match(
        res.getDisplayResults(),
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
        spyPlugin.withArgs('gradle').callCount,
        2,
        'calls gradle plugin 2 times',
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
      loadPlugin.withArgs('golangdep').returns(mockPlugin);
      loadPlugin.callThrough(); // don't mock other plugins

      try {
        const res: CommandResult = await params.cli.test(
          'monorepo-with-nuget',
          {
            allProjects: true,
            detectionDepth: 4,
          },
        );
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
        t.ok(loadPlugin.withArgs('paket').calledOnce, 'calls nuget plugin');
        t.match(
          res.getDisplayResults(),
          /Tested 6 projects, no vulnerable paths were found./,
          'Six projects tested',
        );
        t.match(
          res.getDisplayResults(),
          `Target file:       src${path.sep}paymentservice${path.sep}package-lock.json`,
          'Npm project targetFile is as expected',
        );
        t.match(
          res.getDisplayResults(),
          `Target file:       src${path.sep}cocoapods-app${path.sep}Podfile`,
          'Cocoapods project targetFile is as expected',
        );
        t.match(
          res.getDisplayResults(),
          `Target file:       src${path.sep}frontend${path.sep}Gopkg.lock`,
          'Go dep project targetFile is as expected',
        );
        t.match(
          res.getDisplayResults(),
          `Target file:       src${path.sep}cartservice-nuget${path.sep}obj${path.sep}project.assets.json`,
          'Nuget project targetFile is as expected',
        );
        t.match(
          res.getDisplayResults(),
          `Target file:       test${path.sep}nuget-app-4${path.sep}packages.config`,
          'Nuget project targetFile is as expected',
        );
        t.match(
          res.getDisplayResults(),
          `Target file:       test${path.sep}paket-app${path.sep}paket.dependencies`,
          'Paket project targetFile is as expected',
        );

        t.match(
          res.getDisplayResults(),
          'Package manager:   nuget',
          'Nuget package manager',
        );
        t.match(
          res.getDisplayResults(),
          'Package manager:   cocoapods',
          'Cocoapods package manager',
        );
        t.match(
          res.getDisplayResults(),
          'Package manager:   npm',
          'Npm package manager',
        );
        t.match(
          res.getDisplayResults(),
          'Package manager:   golangdep',
          'Go dep package manager',
        );
      } catch (err) {
        t.fail('expected to pass');
      }
    },
    '`test composer-app --all-projects`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const result: CommandResult = await params.cli.test('composer-app', {
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
        result.getDisplayResults(),
        'Package manager:   composer',
        'contains package manager composer',
      );
      t.match(
        result.getDisplayResults(),
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
      loadPlugin.withArgs('govendor').returns(mockPlugin);
      loadPlugin.callThrough(); // don't mock npm plugin

      const res: CommandResult = await params.cli.test('mono-repo-go', {
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
        res.getDisplayResults(),
        /Tested 4 projects, no vulnerable paths were found./,
        'Four projects tested',
      );
      t.match(
        res.getDisplayResults(),
        `Target file:       hello-dep${path.sep}Gopkg.lock`,
        'Go dep project targetFile is as expected',
      );
      t.match(
        res.getDisplayResults(),
        `Target file:       hello-mod${path.sep}go.mod`,
        'Go mod project targetFile is as expected',
      );
      t.match(
        res.getDisplayResults(),
        `Target file:       hello-node${path.sep}package-lock.json`,
        'Npm project targetFile is as expected',
      );
      t.match(
        res.getDisplayResults(),
        `Target file:       hello-vendor${path.sep}vendor${path.sep}vendor.json`,
        'Go vendor project targetFile is as expected',
      );
      t.match(
        res.getDisplayResults(),
        'Package manager:   golangdep',
        'Nuget package manager',
      );
      t.match(
        res.getDisplayResults(),
        'Package manager:   gomodules',
        'Nuget package manager',
      );
      t.match(
        res.getDisplayResults(),
        'Package manager:   npm',
        'Npm package manager',
      );
      t.match(
        res.getDisplayResults(),
        'Package manager:   govendor',
        'Go dep package manager',
      );
    },
    '`test mono-repo-poetry --all-projects`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const res: CommandResult = await params.cli.test('mono-repo-poetry', {
        allProjects: true,
      });
      t.match(
        res.getDisplayResults(),
        /Tested 2 projects, no vulnerable paths were found./,
        'Two projects tested',
      );
      t.match(
        res.getDisplayResults(),
        'Package manager:   npm',
        'Npm package manager',
      );
      t.match(
        res.getDisplayResults(),
        'Package manager:   poetry',
        'Poetry package manager',
      );
    },
  },
};
