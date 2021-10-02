import * as sinon from 'sinon';
import * as get from 'lodash.get';
import * as isObject from 'lodash.isobject';
import * as path from 'path';
import * as depGraphLib from '@snyk/dep-graph';

interface AcceptanceTests {
  language: string;
  tests: {
    [name: string]: any;
  };
}

export const AllProjectsTests: AcceptanceTests = {
  language: 'Mixed',
  tests: {
    '`monitor mono-repo-with-ignores --all-projects` respects .snyk policy': (
      params,
      utils,
    ) => async (t) => {
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
    '`monitor mono-repo-project --all-projects --detection-depth=1`': (
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

      const result = await params.cli.monitor('mono-repo-project', {
        allProjects: true,
        detectionDepth: 1,
      });
      t.ok(loadPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(loadPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
      t.ok(loadPlugin.withArgs('maven').calledOnce, 'calls maven plugin');
      t.ok(loadPlugin.withArgs('nuget').calledOnce, 'calls nuget plugin');
      t.ok(loadPlugin.withArgs('paket').calledOnce, 'calls nuget plugin');
      t.ok(loadPlugin.withArgs('pip').calledOnce, 'calls pip plugin');
      t.ok(loadPlugin.withArgs('sbt').calledOnce, 'calls sbt plugin');

      t.match(
        result,
        'rubygems/graph/some/project-id',
        'ruby project in output',
      );
      t.match(result, 'npm/graph/some/project-id', 'npm project in output');
      t.match(result, 'maven/some/project-id', 'maven project in output ');
      t.match(result, 'nuget/some/project-id', 'nuget project in output');
      t.match(result, 'paket/some/project-id', 'paket project in output');
      t.match(result, 'pip/some/project-id', 'python project in output ');
      t.match(result, 'sbt/graph/some/project-id', 'sbt project in output ');

      const requests = params.server
        .getRequests()
        .filter((req) => req.url.includes('/monitor/'));
      t.equal(requests.length, 7, 'correct amount of monitor requests');

      const pluginsWithoutTargetFileInBody = [
        'snyk-nodejs-lockfile-parser',
        'bundled:maven',
        'bundled:rubygems',
        'snyk:sbt',
      ];

      requests.forEach((req) => {
        t.match(
          req.url,
          /\/api\/v1\/monitor\/(npm\/graph|rubygems|maven|nuget|paket|pip|sbt)/,
          'puts at correct url',
        );
        if (pluginsWithoutTargetFileInBody.includes(req.body.meta.pluginName)) {
          t.notOk(
            req.body.targetFile,
            `doesn't send the targetFile for ${req.body.meta.pluginName}`,
          );
        } else {
          t.ok(
            req.body.targetFile,
            `does send the targetFile ${req.body.meta.pluginName}`,
          );
        }
        t.equal(req.method, 'PUT', 'makes PUT request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
      });
    },
    '`monitor maven-multi-app --all-projects --detection-depth=2`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const result = await params.cli.monitor('maven-multi-app', {
        allProjects: true,
        detectionDepth: 2,
      });
      t.ok(
        spyPlugin.withArgs('rubygems').notCalled,
        'did not call rubygems plugin',
      );
      t.ok(spyPlugin.withArgs('npm').notCalled, 'did not call npm plugin');
      t.equals(
        spyPlugin.withArgs('maven').callCount,
        2,
        'calls maven plugin twice',
      );
      t.match(result, 'maven/some/project-id', 'maven project was monitored ');

      const requests = params.server.popRequests(2);

      requests.forEach((request) => {
        t.match(request.url, '/api/v1/monitor/maven', 'puts at correct url');
        t.notOk(request.body.targetFile, "doesn't send the targetFile");
        t.equal(request.method, 'PUT', 'makes PUT request');
        t.equal(
          request.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
      });
    },
    '`monitor monorepo-bad-project --all-projects`': (params, utils) => async (
      t,
    ) => {
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
      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(spyPlugin.withArgs('yarn').calledOnce, 'calls npm plugin');
      t.ok(spyPlugin.withArgs('maven').notCalled, 'did not call  maven plugin');

      t.match(
        result,
        'rubygems/graph/some/project-id',
        'rubygems project was monitored',
      );
      t.match(
        result,
        'Dependency snyk was not found in yarn.lock',
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
    '`monitor mono-repo-project --all-projects sends same payload as --file`': (
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

      await params.cli.monitor('mono-repo-project', {
        allProjects: true,
        detectionDepth: 1,
      });

      const requests = params.server
        .getRequests()
        .filter((req) => req.url.includes('/monitor/'));
      // find each type of request
      const rubyAll = requests.find((req) => req.url.indexOf('rubygems') > -1);
      const pipAll = requests.find((req) => req.url.indexOf('pip') > -1);
      const npmAll = requests.find((req) => req.url.indexOf('npm') > -1);
      const nugetAll = requests.find((req) => req.url.indexOf('nuget') > -1);
      const paketAll = requests.find((req) => req.url.indexOf('paket') > -1);
      const mavenAll = requests.find((req) => req.url.indexOf('maven') > -1);
      const sbtAll = requests.find((req) => req.url.indexOf('sbt') > -1);

      params.server.restore();
      await params.cli.monitor('mono-repo-project', {
        file: 'Gemfile.lock',
      });
      const rubyFile = params.server.popRequest();

      params.server.restore();
      await params.cli.monitor('mono-repo-project', {
        file: 'Pipfile',
      });
      const pipFile = params.server.popRequest();

      params.server.restore();
      await params.cli.monitor('mono-repo-project', {
        file: 'package-lock.json',
      });
      const npmFile = params.server.popRequest();

      params.server.restore();
      await params.cli.monitor('mono-repo-project', {
        file: 'packages.config',
      });
      const nugetFile = params.server.popRequest();

      params.server.restore();
      await params.cli.monitor('mono-repo-project', {
        file: 'paket.dependencies',
      });
      const paketFile = params.server.popRequest();

      params.server.restore();
      await params.cli.monitor('mono-repo-project', {
        file: 'pom.xml',
      });
      const mavenFile = params.server.popRequest();

      params.server.restore();
      await params.cli.monitor('mono-repo-project', {
        file: 'build.sbt',
      });
      const sbtFile = params.server.popRequest();

      t.same(
        rubyAll.body,
        rubyFile.body,
        'same body for --all-projects and --file=Gemfile.lock',
      );

      t.same(
        pipAll.body,
        pipFile.body,
        'same body for --all-projects and --file=Pipfile',
      );

      t.same(
        npmAll.body,
        npmFile.body,
        'same body for --all-projects and --file=package-lock.json',
      );

      t.same(
        nugetAll.body,
        nugetFile.body,
        'same body for --all-projects and --file=packages.config',
      );

      t.same(
        paketAll.body,
        paketFile.body,
        'same body for --all-projects and --file=paket.dependencies',
      );

      t.same(
        mavenAll.body,
        mavenFile.body,
        'same body for --all-projects and --file=pom.xml',
      );

      t.same(
        sbtAll.body,
        sbtFile.body,
        'same body for --all-projects and --file=build.sbt',
      );
    },
    '`monitor composer-app with --all-projects sends same payload as --file`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      await params.cli.monitor('composer-app', {
        allProjects: true,
      });
      const composerAll = params.server.popRequest();

      await params.cli.monitor('composer-app', {
        file: 'composer.lock',
      });
      const composerFile = params.server.popRequest();

      t.same(
        composerAll.body,
        composerFile.body,
        'same body for --all-projects and --file=composer.lock',
      );
    },
    '`monitor mono-repo-project with lockfiles --all-projects --json`': (
      params,
      utils,
    ) => async (t) => {
      try {
        utils.chdirWorkspaces();

        // mock python plugin becuase CI tooling doesn't have pipenv installed
        const mockPlugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'Pipfile',
                name: 'snyk-python-plugin',
              },
              package: {
                name: 'mono-repo-project', // used by projectName
              },
            };
          },
        };
        const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
        t.teardown(loadPlugin.restore);
        loadPlugin.withArgs('pip').returns(mockPlugin);
        loadPlugin.callThrough(); // don't mock other plugins

        const response = await params.cli.monitor('mono-repo-project', {
          json: true,
          allProjects: true,
          detectionDepth: 1,
        });

        const jsonResponse = JSON.parse(response);
        t.equal(
          jsonResponse.length,
          7,
          'json response array has expected # elements',
        );

        jsonResponse.forEach((res) => {
          if (isObject(res)) {
            t.pass('monitor outputted JSON');
          } else {
            t.fail('Failed parsing monitor JSON output');
          }

          const keyList = [
            'packageManager',
            'manageUrl',
            'id',
            'projectName',
            'isMonitored',
          ];

          keyList.forEach((k) => {
            !get(res, k) ? t.fail(k + ' not found') : t.pass(k + ' found');
          });
        });
      } catch (error) {
        t.fail('should have passed', error);
      }
    },
    '`monitor maven-multi-app --all-projects --detection-depth=2 --exclude=simple-child`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);
      const result = await params.cli.monitor('maven-multi-app', {
        allProjects: true,
        detectionDepth: 2,
        exclude: 'simple-child',
      });
      t.ok(
        spyPlugin.withArgs('rubygems').notCalled,
        'did not call rubygems plugin',
      );
      t.ok(spyPlugin.withArgs('npm').notCalled, 'did not call npm plugin');
      t.equals(
        spyPlugin.withArgs('maven').callCount,
        1,
        'calls maven plugin once, excluding simple-child',
      );
      t.match(result, 'maven/some/project-id', 'maven project was monitored ');
      const request = params.server.popRequest();
      t.match(request.url, '/monitor/', 'puts at correct url');
      t.notOk(request.body.targetFile, "doesn't send the targetFile");
      t.equal(request.method, 'PUT', 'makes PUT request');
      t.equal(
        request.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
    },
    '`monitor monorepo-with-nuget --all-projects sends same payload as --file`': (
      params,
      utils,
    ) => async (t) => {
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
    '`monitor mono-repo-go/hello-dep --all-projects sends same body as --file`': (
      params,
      utils,
    ) => async (t) => {
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
    '`monitor mono-repo-go/hello-mod --all-projects sends same body as --file`': (
      params,
      utils,
    ) => async (t) => {
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
    '`monitor mono-repo-go/hello-vendor --all-projects sends same body as --file`': (
      params,
      utils,
    ) => async (t) => {
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

    '`monitor mono-repo-go with --all-projects and --detectin-depth=3`': (
      params,
      utils,
    ) => async (t) => {
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
      t.match(result, 'golangdep/some/project-id', 'dep project was monitored');
      t.match(result, 'gomodules/some/project-id', 'mod project was monitored');
      t.match(result, 'npm/graph/some/project-id', 'npm project was monitored');
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
    '`monitor gradle-monorepo with --all-projects`': (params, utils) => async (
      t,
    ) => {
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
        t.notOk(req.body.targetFile, "doesn't send the targetFile");
        t.equal(req.method, 'PUT', 'makes PUT request');
        t.equal(
          req.headers['x-snyk-cli-version'],
          params.versionNumber,
          'sends version number',
        );
      });
    },
    '`monitor kotlin-monorepo --all-projects` scans kotlin files': (
      params,
      utils,
    ) => async (t) => {
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
      t.ok(loadPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
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
    '`monitor mono-repo-poetry with --all-projects --detection-depth=2`': (
      params,
      utils,
    ) => async (t) => {
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
  },
};
