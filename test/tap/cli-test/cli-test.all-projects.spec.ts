import * as sinon from 'sinon';
import * as path from 'path';
import * as depGraphLib from '@snyk/dep-graph';
import { CommandResult } from '../../../src/cli/commands/types';
import { AcceptanceTests } from '../cli-test.acceptance.test';
import { icon } from '../../../src/lib/theme';
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
      loadPlugin.returns(plugin);
      t.teardown(loadPlugin.restore);

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
        `${icon.ISSUE} 1/3 detected Gradle manifests did not return dependencies. ` +
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
      loadPlugin.withArgs('gradle').returns(plugin);
      loadPlugin.callThrough();
      t.teardown(loadPlugin.restore);

      const result: CommandResult = await params.cli.test('kotlin-monorepo', {
        allProjects: true,
        detectionDepth: 3,
      });
      t.ok(loadPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(loadPlugin.withArgs('gradle').calledOnce, 'calls gradle plugin');

      const backendRequests = params.server.popRequests(2);
      t.equal(backendRequests.length, 2);

      backendRequests.forEach((req) => {
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
      t.equal(requests.length, 7);
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
        'Same body for --all-projects and --file=paket.dependencies',
      );

      t.same(
        nugetAll.body,
        nugetFile.body,
        'Same body for --all-projects and --file=packages.config',
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
    // TODO: move to jest test or delete
    //     '`test large-mono-repo with --all-projects and --detection-depth=7`': (
    //       params,
    //       utils,
    //     ) => async (t) => {
    //       utils.chdirWorkspaces();
    //       const mockPlugin = {
    //         async inspect() {
    //           return {
    //             plugin: {
    //               name: 'custom',
    //               runtime: 'unknown',
    //               meta: {},
    //             },
    //             scannedProjects: [],
    //           };
    //         },
    //       };
    //       const spyPlugin = sinon.stub(params.plugins, 'loadPlugin');
    //       spyPlugin.returns(mockPlugin);

    //       t.teardown(spyPlugin.restore);
    //       await params.cli.test('large-mono-repo', {
    //         allProjects: true,
    //         detectionDepth: 7,
    //       });
    //       t.equals(
    //         spyPlugin.withArgs('rubygems').callCount,
    //         19,
    //         'calls rubygems plugin 19 times',
    //       );
    //       t.equals(
    //         spyPlugin.withArgs('npm').callCount,
    //         19,
    //         'calls npm plugin 19 times',
    //       );
    //       t.equals(
    //         spyPlugin.withArgs('gradle').callCount,
    //         2,
    //         'calls gradle plugin 2 times',
    //       );
    //       // TODO: the mock does not contain the arguments the plugin is called with
    //       // review this
    //       // t.equals(
    //       //   spyPlugin.withArgs('gradle').args[0][1].allSubProjects,
    //       //   true,
    //       //   'calls gradle plugin with allSubProjects property',
    //       // );
    //       t.equals(
    //         spyPlugin.withArgs('maven').callCount,
    //         6,
    //         'calls maven plugin 6 times',
    //       );
    //     },

    // TODO: move to the jest test
    //     '`test monorepo-with-nuget --all-projects with Nuget, Python, Go, Npm, Cocoapods`': (
    //       params,
    //       utils,
    //     ) => async (t) => {
    //       utils.chdirWorkspaces();
    //       const mockGoLangPlugin = {
    //         async inspect() {
    //           return {
    //             package: {},
    //             plugin: {
    //               name: 'mock',
    //             },
    //           };
    //         },
    //       };
    //       const mockPlugin = {
    //         async inspect() {
    //           return {
    //             plugin: {
    //               name: 'custom',
    //               runtime: 'unknown',
    //               meta: {},
    //             },
    //             scannedProjects: [],
    //           };
    //         },
    //       };
    //       const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
    //       t.teardown(loadPlugin.restore);
    //       // prevent plugin inspect from actually running (requires go to be installed)
    //       loadPlugin.withArgs('golangdep').returns(mockGoLangPlugin);
    //       loadPlugin.returns(mockPlugin);

    //       try {
    //         const res: CommandResult = await params.cli.test(
    //           'monorepo-with-nuget',
    //           {
    //             allProjects: true,
    //             detectionDepth: 4,
    //           },
    //         );
    //         t.equal(
    //           loadPlugin.withArgs('nuget').callCount,
    //           2,
    //           'calls nuget plugin twice',
    //         );
    //         t.ok(
    //           loadPlugin.withArgs('cocoapods').calledOnce,
    //           'calls cocoapods plugin',
    //         );
    //         t.ok(loadPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
    //         t.ok(
    //           loadPlugin.withArgs('golangdep').calledOnce,
    //           'calls golangdep plugin',
    //         );
    //         t.ok(loadPlugin.withArgs('paket').calledOnce, 'calls nuget plugin');
    //         t.match(
    //           res.getDisplayResults(),
    //           /Tested 6 projects, no vulnerable paths were found./,
    //           'Six projects tested',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           `Target file:       src${path.sep}paymentservice${path.sep}package-lock.json`,
    //           'Npm project targetFile is as expected',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           `Target file:       src${path.sep}cocoapods-app${path.sep}Podfile`,
    //           'Cocoapods project targetFile is as expected',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           `Target file:       src${path.sep}frontend${path.sep}Gopkg.lock`,
    //           'Go dep project targetFile is as expected',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           `Target file:       src${path.sep}cartservice-nuget${path.sep}obj${path.sep}project.assets.json`,
    //           'Nuget project targetFile is as expected',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           `Target file:       test${path.sep}nuget-app-4${path.sep}packages.config`,
    //           'Nuget project targetFile is as expected',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           `Target file:       test${path.sep}paket-app${path.sep}paket.dependencies`,
    //           'Paket project targetFile is as expected',
    //         );

    //         t.match(
    //           res.getDisplayResults(),
    //           'Package manager:   nuget',
    //           'Nuget package manager',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           'Package manager:   cocoapods',
    //           'Cocoapods package manager',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           'Package manager:   npm',
    //           'Npm package manager',
    //         );
    //         t.match(
    //           res.getDisplayResults(),
    //           'Package manager:   golangdep',
    //           'Go dep package manager',
    //         );
    //       } catch (err) {
    //         t.fail('expected to pass');
    //       }
    //     },
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
    'test yarn-workspaces-v2-resolutions --all-projects --detection-depth=5 --strict-out-of-sync=false (yarn v2 with resolutions)': (
      params,
      utils,
    ) => async (t) => {
      // Yarn workspaces for Yarn 2 is only supported on Node 10+
      utils.chdirWorkspaces();
      const result = await params.cli.test('yarn-workspaces-v2-resolutions', {
        allProjects: true,
        detectionDepth: 5,
        strictOutOfSync: false,
        printDeps: true,
      });
      const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');
      // the parser is used directly
      t.ok(loadPlugin.withArgs('yarn').notCalled, 'skips load plugin');
      t.teardown(() => {
        loadPlugin.restore();
      });
      t.match(
        result.getDisplayResults(),
        '✔ Tested 1 dependencies for known vulnerabilities, no vulnerable paths found.',
        'correctly showing dep number',
      );
      t.match(result.getDisplayResults(), 'Package manager:   yarn\n');
      t.match(
        result.getDisplayResults(),
        'Project name:      package.json',
        'yarn project in output',
      );
      t.match(
        result.getDisplayResults(),
        'Project name:      tomatoes',
        'yarn project in output',
      );
      t.match(
        result.getDisplayResults(),
        'Project name:      apples',
        'yarn project in output',
      );
      t.match(
        result.getDisplayResults(),
        'Tested 3 projects, no vulnerable paths were found.',
        'no vulnerable paths found as both policies detected and applied.',
      );
    },
    'test --all-projects --detection-depth=5 finds Yarn workspaces & Npm projects': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const result = await params.cli.test('yarn-workspaces', {
        allProjects: true,
        detectionDepth: 5,
      });
      const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');
      // the parser is used directly
      t.ok(loadPlugin.withArgs('yarn').notCalled, 'skips load plugin');
      t.teardown(() => {
        loadPlugin.restore();
      });
      const output = result.getDisplayResults();
      t.match(output, 'Package manager:   yarn\n');
      t.match(output, 'Package manager:   npm\n');
      t.match(
        output,
        'Target file:       not-part-of-workspace/package-lock.json',
        'npm project in outside of yarn workspace is in output',
      );
      t.match(
        output,
        'Target file:       not-part-of-workspace-yarn/yarn.lock',
        'yarn project outside of workspace is in the output',
      );
      t.match(
        output,
        'Project name:      package.json',
        'yarn project in output',
      );
      t.match(
        output,
        'Project name:      tomatoes',
        'workspace yarn project in output',
      );
      t.match(
        output,
        'Project name:      apples',
        'workspace yarn project in output',
      );
      t.match(
        output,
        'Project name:      apple-lib',
        'workspace yarn project in output',
      );

      t.match(
        output,
        'Tested 6 projects, no vulnerable paths were found.',
        'tested 4 workspace projects, 1 npm project and 1 yarn project',
      );
      let policyCount = 0;
      const applesWorkspace =
        process.platform === 'win32'
          ? '\\apples\\package.json'
          : 'apples/package.json';
      const tomatoesWorkspace =
        process.platform === 'win32'
          ? '\\tomatoes\\package.json'
          : 'tomatoes/package.json';
      const rootWorkspace =
        process.platform === 'win32'
          ? '\\yarn-workspaces\\package.json'
          : 'yarn-workspaces/package.json';

      const backendRequests = params.server.popRequests(6);
      t.equal(backendRequests.length, 6);

      backendRequests.forEach((req) => {
        t.equal(req.method, 'POST', 'makes POST request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
        t.match(req.url, '/api/v1/test-dep-graph', 'posts to correct url');
        t.ok(req.body.depGraph, 'body contains depGraph');

        if (req.body.targetFileRelativePath.endsWith(applesWorkspace)) {
          t.match(
            req.body.policy,
            'npm:node-uuid:20160328',
            'policy is as expected',
          );
          t.ok(req.body.policy, 'body contains policy');
          policyCount += 1;
        } else if (
          req.body.targetFileRelativePath.endsWith(tomatoesWorkspace)
        ) {
          t.notOk(req.body.policy, 'body does not contain policy');
        } else if (req.body.targetFileRelativePath.endsWith(rootWorkspace)) {
          t.match(
            req.body.policy,
            'npm:node-uuid:20111130',
            'policy is as expected',
          );
          t.ok(req.body.policy, 'body contains policy');
          policyCount += 1;
        }
        t.match(
          req.body.depGraph.pkgManager.name,
          /(yarn|npm)/,
          'depGraph has package manager',
        );
      });
      t.equal(policyCount, 2, '2 policies found in a workspace');
    },
  },
};
