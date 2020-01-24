import * as sinon from 'sinon';
import * as _ from 'lodash';

interface AcceptanceTests {
  language: string;
  tests: {
    [name: string]: any;
  };
}

export const AllProjectsTests: AcceptanceTests = {
  language: 'Mixed (Ruby & Npm & Maven)',
  tests: {
    '`monitor mono-repo-project with lockfiles --all-projects`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      const result = await params.cli.monitor('mono-repo-project', {
        allProjects: true,
        detectionDepth: 1,
      });
      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(spyPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
      t.ok(spyPlugin.withArgs('maven').calledOnce, 'calls maven plugin');
      // npm
      t.match(
        result,
        'npm/graph/some/project-id',
        'npm project was monitored (via graph endpoint)',
      );
      // rubygems
      t.match(
        result,
        'rubygems/some/project-id',
        'rubygems project was monitored',
      );

      // maven
      t.match(result, 'maven/some/project-id', 'maven project was monitored ');
      // Pop all calls to server and filter out calls to `featureFlag` endpoint
      const requests = params.server
        .popRequests(4)
        .filter((req) => req.url.includes('/monitor/'));
      t.equal(requests.length, 3, 'Correct amount of monitor requests');

      requests.forEach((req) => {
        t.match(req.url, '/monitor/', 'puts at correct url');
        t.notOk(req.body.targetFile, "doesn't send the targetFile");
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
      // maven
      t.match(result, 'maven/some/project-id', 'maven project was monitored ');

      const requests = params.server.popRequests(2);

      requests.forEach((request) => {
        // once we have depth increase released
        t.ok(request, 'Monitor POST request');

        t.match(request.url, '/monitor/', 'puts at correct url');
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

      const result = await params.cli.monitor('monorepo-bad-project', {
        allProjects: true,
      });
      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(spyPlugin.withArgs('yarn').calledOnce, 'calls npm plugin');
      t.ok(spyPlugin.withArgs('maven').notCalled, 'did not call  maven plugin');

      // rubygems
      t.match(
        result,
        'rubygems/some/project-id',
        'rubygems project was monitored',
      );
      // yarn
      // yarn project fails with OutOfSyncError, no monitor output shown
      const request = params.server.popRequest();

      t.ok(request, 'Monitor POST request');

      t.match(request.url, '/monitor/', 'puts at correct url');
      t.notOk(request.body.targetFile, "doesn't send the targetFile");
      t.equal(request.method, 'PUT', 'makes PUT request');
      t.equal(
        request.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
    },
    '`monitor mono-repo-project with lockfiles --all-projects and without same meta`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
      t.teardown(spyPlugin.restore);

      await params.cli.monitor('mono-repo-project', {
        allProjects: true,
        detectionDepth: 1,
      });
      // Pop all calls to server and filter out calls to `featureFlag` endpoint
      const [rubyAll, npmAll, mavenAll] = params.server
        .popRequests(4)
        .filter((req) => req.url.includes('/monitor/'));

      // Ruby
      await params.cli.monitor('mono-repo-project', {
        file: 'Gemfile.lock',
      });
      const [requestsRuby] = params.server
        .popRequests(2)
        .filter((req) => req.url.includes('/monitor/'));

      // npm
      await params.cli.monitor('mono-repo-project', {
        file: 'package-lock.json',
      });
      const [requestsNpm] = params.server
        .popRequests(2)
        .filter((req) => req.url.includes('/monitor/'));

      // maven
      await params.cli.monitor('mono-repo-project', {
        file: 'pom.xml',
      });
      const [requestsMaven] = params.server
        .popRequests(2)
        .filter((req) => req.url.includes('/monitor/'));

      // Ruby project

      t.deepEqual(
        rubyAll.body,
        requestsRuby.body,
        'Same body for --all-projects and --file=Gemfile.lock',
      );

      // NPM project

      t.deepEqual(
        npmAll.body,
        requestsNpm.body,
        'Same body for --all-projects and --file=package-lock.json',
      );

      // Maven project

      t.deepEqual(
        mavenAll.body,
        requestsMaven.body,
        'Same body for --all-projects and --file=pom.xml',
      );
    },
    '`monitor mono-repo-project with lockfiles --all-projects --json`': (
      params,
      utils,
    ) => async (t) => {
      try {
        utils.chdirWorkspaces();
        const spyPlugin = sinon.spy(params.plugins, 'loadPlugin');
        t.teardown(spyPlugin.restore);

        const response = await params.cli.monitor('mono-repo-project', {
          json: true,
          allProjects: true,
        });
        JSON.parse(response).forEach((res) => {
          if (_.isObject(res)) {
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
            !_.get(res, k) ? t.fail(k + ' not found') : t.pass(k + ' found');
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
      t.ok(request, 'Monitor POST request');
      t.match(request.url, '/monitor/', 'puts at correct url');
      t.notOk(request.body.targetFile, "doesn't send the targetFile");
      t.equal(request.method, 'PUT', 'makes PUT request');
      t.equal(
        request.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
    },
  },
};
