import * as sinon from 'sinon';

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
      });
      t.ok(spyPlugin.withArgs('rubygems').calledOnce, 'calls rubygems plugin');
      t.ok(spyPlugin.withArgs('npm').calledOnce, 'calls npm plugin');
      t.ok(spyPlugin.withArgs('maven').calledOnce, 'calls maven plugin');

      // TODO: check all results have the relevant packageManager set
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
      t.match(
        result,
        'maven/graph/some/project-id',
        'maven project was monitored ',
      );

      // Pop all calls to server and filter out calls to `featureFlag` endpoint
      const requests = params.server
        .popRequests(6)
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
    // TODO: add a test that validates the same meta for each monitor
    // call with & without using --all-projects
  },
};
