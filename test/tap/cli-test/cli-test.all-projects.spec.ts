import * as sinon from 'sinon';
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
