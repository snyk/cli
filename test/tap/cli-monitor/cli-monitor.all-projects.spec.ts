import * as sinon from 'sinon';
import * as path from 'path';
import * as depGraphLib from '@snyk/dep-graph';
import { getWorkspacePath } from '../../jest/util/getWorkspacePath';

interface AcceptanceTests {
  language: string;
  tests: {
    [name: string]: any;
  };
}

export const AllProjectsTests: AcceptanceTests = {
  language: 'Mixed',
  tests: {
    '`monitor mono-repo-with-ignores --all-projects` respects .snyk policy':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
        await params.cli.monitor('mono-repo-with-ignores', {
          allProjects: true,
          detectionDepth: 2,
        });
        const requests = params.server
          .getRequests()
          .filter((req) => req.url.includes('/monitor/'));
        let policyCount = 0;
        requests.forEach((req) => {
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
        });
        t.equal(policyCount, 1, 'one policy found');
      },
    '`monitor monorepo-bad-project --all-projects`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
        const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
        t.teardown(spyPlugin.restore);
        let result;
        try {
          await params.cli.monitor('monorepo-bad-project', {
            allProjects: true,
          });
        } catch (error) {
          result = error.message;
        }
        t.ok(
          spyPlugin.withArgs('rubygems').calledOnce,
          'calls rubygems plugin',
        );
        t.ok(spyPlugin.withArgs('yarn').calledOnce, 'calls npm plugin');
        t.ok(
          spyPlugin.withArgs('maven').notCalled,
          'did not call  maven plugin',
        );

        t.match(
          result,
          'rubygems/graph/some/project-id',
          'rubygems project was monitored',
        );
        t.match(
          result,
          'Dependency snyk@* was not found in yarn.lock',
          'yarn project had an error and we displayed it',
        );

        const request = params.server.popRequest();

        t.match(
          request.url,
          '/api/v1/monitor/rubygems/graph',
          'puts at correct url',
        );
        t.notOk(request.body.targetFile, "doesn't send the targetFile");
        t.equal(request.method, 'PUT', 'makes PUT request');
        t.equal(
          request.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
      },
    '`monitor monorepo-with-nuget --all-projects sends same payload as --file`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();

        // mock go plugin becuase CI tooling doesn't have go installed
        const mockPlugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'Gopkg.lock',
                name: 'snyk-go-plugin',
                runtime: 'go',
              },
              package: {},
            };
          },
        };
        const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
        t.teardown(loadPlugin.restore);
        loadPlugin.withArgs('golangdep').returns(mockPlugin);
        loadPlugin.callThrough(); // don't mock other plugins

        await params.cli.monitor('monorepo-with-nuget', {
          allProjects: true,
          detectionDepth: 4,
        });

        const [
          projectAssetsAll,
          cocoapodsAll,
          golangdepAll,
          npmAll,
          packageConfigAll,
          paketAll,
        ] = params.server
          .getRequests()
          .filter((req) => req.url.includes('/monitor/'));

        params.server.restore();
        await params.cli.monitor('monorepo-with-nuget', {
          file: `src${path.sep}cartservice-nuget${path.sep}obj${path.sep}project.assets.json`,
        });
        const projectAssetsFile = params.server.popRequest();

        params.server.restore();
        await params.cli.monitor('monorepo-with-nuget', {
          file: `src${path.sep}cocoapods-app${path.sep}Podfile.lock`,
        });
        const cocoapodsFile = params.server.popRequest();

        params.server.restore();
        await params.cli.monitor('monorepo-with-nuget', {
          file: `src${path.sep}frontend${path.sep}Gopkg.lock`,
        });
        const golangdepFile = params.server.popRequest();

        params.server.restore();
        await params.cli.monitor('monorepo-with-nuget', {
          file: `src${path.sep}paymentservice${path.sep}package-lock.json`,
        });
        const npmFile = params.server.popRequest();

        params.server.restore();
        await params.cli.monitor('monorepo-with-nuget', {
          file: `test${path.sep}nuget-app-4${path.sep}packages.config`,
        });
        const packageConfigFile = params.server.popRequest();

        params.server.restore();
        await params.cli.monitor('monorepo-with-nuget', {
          file: `test${path.sep}paket-app${path.sep}paket.dependencies`,
        });
        const paketFile = params.server.popRequest();

        t.same(
          projectAssetsAll.body,
          projectAssetsFile.body,
          `same body for --all-projects and --file=src${path.sep}cartservice-nuget${path.sep}obj${path.sep}project.assets.json`,
        );
        t.same(
          cocoapodsAll.body,
          cocoapodsFile.body,
          `same body for --all-projects and --file=src${path.sep}cocoapods-app${path.sep}Podfile.lock`,
        );
        t.same(
          golangdepAll.body,
          golangdepFile.body,
          `same body for --all-projects and --file=src${path.sep}frontend${path.sep}Gopkg.lock`,
        );
        t.same(
          npmAll.body,
          npmFile.body,
          `same body for --all-projects and --file=src${path.sep}paymentservice${path.sep}package-lock.json`,
        );
        t.same(
          packageConfigAll.body,
          packageConfigFile.body,
          `same body for --all-projects and --file=test${path.sep}nuget-app-4${path.sep}packages.config`,
        );
        t.same(
          paketAll.body,
          paketFile.body,
          `same body for --all-projects and --file=test${path.sep}paket-app${path.sep}paket.dependencies`,
        );
      },
    '`monitor mono-repo-go/hello-dep --all-projects sends same body as --file`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
        // mock plugin becuase CI tooling doesn't have go installed
        const mockPlugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'Gopkg.lock',
                name: 'snyk-go-plugin',
                runtime: 'go',
              },
              package: {},
            };
          },
        };
        const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
        t.teardown(loadPlugin.restore);
        loadPlugin.withArgs('golangdep').returns(mockPlugin);
        await params.cli.monitor('mono-repo-go/hello-dep', {
          allProjects: true,
        });
        const allProjectsBody = params.server.popRequest();
        await params.cli.monitor('mono-repo-go/hello-dep', {
          file: 'Gopkg.lock',
        });
        const fileBody = params.server.popRequest();
        t.same(
          allProjectsBody.body,
          fileBody.body,
          'same body for --all-projects and --file=mono-repo-go/hello-dep/Gopkg.lock',
        );
      },
    '`monitor mono-repo-go/hello-mod --all-projects sends same body as --file`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
        // mock plugin becuase CI tooling doesn't have go installed
        const mockPlugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'go.mod',
                name: 'snyk-go-plugin',
                runtime: 'go',
              },
              package: {},
            };
          },
        };
        const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
        t.teardown(loadPlugin.restore);
        loadPlugin.withArgs('gomodules').returns(mockPlugin);
        await params.cli.monitor('mono-repo-go/hello-mod', {
          allProjects: true,
        });
        const allProjectsBody = params.server.popRequest();
        await params.cli.monitor('mono-repo-go/hello-mod', {
          file: 'go.mod',
        });
        const fileBody = params.server.popRequest();
        t.same(
          allProjectsBody.body,
          fileBody.body,
          'same body for --all-projects and --file=mono-repo-go/hello-mod/go.mod',
        );
      },
    '`monitor mono-repo-go/hello-vendor --all-projects sends same body as --file`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
        // mock plugin becuase CI tooling doesn't have go installed
        const mockPlugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'vendor/vendor.json',
                name: 'snyk-go-plugin',
                runtime: 'go',
              },
              package: {},
            };
          },
        };
        const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
        t.teardown(loadPlugin.restore);
        loadPlugin.withArgs('govendor').returns(mockPlugin);
        await params.cli.monitor('mono-repo-go/hello-vendor', {
          allProjects: true,
        });
        const allProjectsBody = params.server.popRequest();
        await params.cli.monitor('mono-repo-go/hello-vendor', {
          file: 'vendor/vendor.json',
        });
        const fileBody = params.server.popRequest();
        t.same(
          allProjectsBody.body,
          fileBody.body,
          'same body for --all-projects and --file=mono-repo-go/hello-vendor/vendor/vendor.json',
        );
      },
    '`monitor mono-repo-go with --all-projects and --detection-depth=3`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
        // mock plugin becuase CI tooling doesn't have go installed
        const mockPlugin = {
          async inspect() {
            return {
              plugin: {
                name: 'mock',
              },
              package: {},
            };
          },
        };
        const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
        t.teardown(loadPlugin.restore);
        loadPlugin.withArgs('golangdep').returns(mockPlugin);
        loadPlugin.withArgs('gomodules').returns(mockPlugin);
        loadPlugin.withArgs('govendor').returns(mockPlugin);
        loadPlugin.callThrough(); // don't mock npm plugin
        const result = await params.cli.monitor('mono-repo-go', {
          allProjects: true,
          detectionDepth: 3,
        });
        t.match(
          result,
          'golangdep/some/project-id',
          'dep project was monitored',
        );
        t.match(
          result,
          'gomodules/some/project-id',
          'mod project was monitored',
        );
        t.match(
          result,
          'npm/graph/some/project-id',
          'npm project was monitored',
        );
        t.match(
          result,
          'govendor/some/project-id',
          'vendor project was monitored',
        );

        const requests = params.server
          .getRequests()
          .filter((req) => req.url.includes('/monitor/'));
        t.equal(requests.length, 4, 'correct amount of monitor requests');

        requests.forEach((req) => {
          t.match(
            req.url,
            /\/api\/v1\/monitor\/(npm\/graph|golangdep|gomodules|govendor)/,
            'puts at correct url',
          );
          t.notOk(req.body.targetFile, "doesn't send the targetFile");
          t.equal(req.method, 'PUT', 'makes PUT request');
          t.equal(
            req.headers['x-snyk-cli-version'],
            params.versionNumber,
            'sends version number',
          );
        });
      },
    '`monitor gradle-monorepo with --all-projects`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
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
                  targetFile:
                    getWorkspacePath('gradle-monorepo') +
                    '/subproj/build.gradle',
                },
              ],
            };
          },
        };
        const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
        t.teardown(loadPlugin.restore);
        loadPlugin.withArgs('gradle').returns(plugin);
        loadPlugin.callThrough();
        const result = await params.cli.monitor('gradle-monorepo', {
          allProjects: true,
          detectionDepth: 3,
          d: true,
        });
        t.match(
          result,
          'gradle/graph/some/project-id',
          'gradle project was monitored',
        );
        t.match(
          result,
          'npm/graph/some/project-id',
          'gradle project was monitored',
        );

        let policyCount = 0;
        const requests = params.server
          .getRequests()
          .filter((req) => req.url.includes('/monitor/'));
        t.equal(requests.length, 3, 'correct amount of monitor requests');
        requests.forEach((req) => {
          t.match(
            req.url,
            /\/api\/v1\/monitor\/(npm\/graph|gradle\/graph)/,
            'puts at correct url',
          );

          if (req.body.policy) {
            policyCount++;
          }
          t.notOk(req.body.targetFile, "doesn't send the targetFile");
          t.equal(req.method, 'PUT', 'makes PUT request');
          t.equal(
            req.headers['x-snyk-cli-version'],
            params.versionNumber,
            'sends version number',
          );
        });
        t.equal(policyCount, 1, '1 nested policy found in monorepo');
      },
    '`monitor kotlin-monorepo --all-projects` scans kotlin files':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
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

        const result = await params.cli.monitor('kotlin-monorepo', {
          allProjects: true,
          detectionDepth: 3,
        });
        t.ok(
          loadPlugin.withArgs('rubygems').calledOnce,
          'calls rubygems plugin',
        );
        t.ok(loadPlugin.withArgs('gradle').calledOnce, 'calls gradle plugin');

        t.match(
          result,
          'gradle/graph/some/project-id',
          'gradle project was monitored',
        );
        t.match(
          result,
          'rubygems/graph/some/project-id',
          'rubygems project was monitored',
        );

        const requests = params.server
          .getRequests()
          .filter((req) => req.url.includes('/monitor/'));
        t.equal(requests.length, 3, 'correct amount of monitor requests');
        requests.forEach((req) => {
          t.match(
            req.url,
            /\/api\/v1\/monitor\/(rubygems\/graph|gradle\/graph)/,
            'puts at correct url',
          );
          t.notOk(req.body.targetFile, "doesn't send the targetFile");
          t.equal(req.method, 'PUT', 'makes PUT request');
          t.equal(
            req.headers['x-snyk-cli-version'],
            params.versionNumber,
            'sends version number',
          );
        });
      },
    '`monitor mono-repo-poetry with --all-projects --detection-depth=2`':
      (params, utils) => async (t) => {
        utils.chdirWorkspaces();
        const result = await params.cli.monitor('mono-repo-poetry', {
          allProjects: true,
          detectionDepth: 2,
        });
        t.match(
          result,
          'npm/graph/some/project-id',
          'npm project was monitored ',
        );
        t.match(
          result,
          'poetry/graph/some/project-id',
          'poetry project was monitored ',
        );
        const requests = params.server.popRequests(2);
        requests.forEach((request) => {
          const urlOk =
            request.url === '/api/v1/monitor/npm' ||
            '/api/v1/monitor/poetry/graph';
          t.ok(urlOk, 'puts at correct url');
          t.equal(request.method, 'PUT', 'makes PUT request');
          t.equal(
            request.headers['x-snyk-cli-version'],
            params.versionNumber,
            'sends version number',
          );
        });
      },
    'monitor yarn-workspaces --all-projects --detection-depth=5 finds Yarn workspaces, Npm and Yarn projects':
      (params, utils) => async (t) => {
        t.teardown(() => {
          loadPlugin.restore();
        });
        utils.chdirWorkspaces();
        const loadPlugin = sinon.spy(params.plugins, 'loadPlugin');

        const result = await params.cli.monitor('yarn-workspaces', {
          allProjects: true,
          detectionDepth: 5,
        });
        // the parser is used directly
        t.equal(
          loadPlugin.withArgs('yarn').callCount,
          1,
          'loads plugin for yarn as we detect a Yarn projevct inside a workspace',
        );
        t.equal(
          loadPlugin.withArgs('npm').callCount,
          1,
          'calls npm plugin once',
        );

        t.match(
          result,
          'Monitoring yarn-workspaces (package.json)',
          'yarn workspace root was monitored',
        );
        t.match(
          result,
          'Monitoring yarn-workspaces (apple-lib)',
          'yarn workspace was monitored',
        );
        t.match(
          result,
          'Monitoring yarn-workspaces (apples)',
          'yarn workspace was monitored',
        );
        t.match(
          result,
          'Monitoring yarn-workspaces (tomatoes)',
          'yarn workspace was monitored',
        );
        t.match(
          result,
          'Monitoring yarn-workspaces (not-in-a-workspace)',
          'npm project was monitored',
        );
        t.match(
          result,
          'Monitoring yarn-workspaces (not-part-of-workspace)',
          'yarn project was monitored',
        );

        const requests = params.server
          .getRequests()
          .filter((req) => req.url.includes('/monitor/'));
        t.equal(requests.length, 6, 'correct amount of monitor requests');
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
        requests.forEach((req) => {
          t.match(
            req.url,
            /\/api\/v1\/monitor\/(yarn\/graph|npm\/graph)/,
            'puts at correct url',
          );
          t.equal(req.method, 'PUT', 'makes PUT request');
          t.equal(
            req.headers['x-snyk-cli-version'],
            params.versionNumber,
            'sends version number',
          );
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
        });
        t.equal(policyCount, 2, '2 policies found in a workspace');
      },
  },
};
