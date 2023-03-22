import { AcceptanceTests } from '../cli-test.acceptance.test';
import { CommandResult } from '../../../src/cli/commands/types';
import { getFixturePath } from '../../jest/util/getFixturePath';

export const NpmTests: AcceptanceTests = {
  language: 'NPM',
  tests: {
    '`test npm-package with custom --project-name`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package', {
        'project-name': 'custom-project-name',
      });
      const req = params.server.popRequest();
      t.match(
        req.body.projectNameOverride,
        'custom-project-name',
        'custom project name is passed',
      );
      t.match(req.body.targetFile, undefined, 'target is undefined');
    },

    '`test npm-package with lockfile v2`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package-lockfile-v2');
      const req = params.server.popRequest();
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package-lockfile-v2@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
        'depGraph looks fine',
      );
    },

    '`test npm-package with lockfile v3`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package-lockfile-v3');
      const req = params.server.popRequest();
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package-lockfile-v3@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
        'depGraph looks fine',
      );
    },

    'test npm-package remoteUrl': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      process.env.GIT_DIR = 'npm-package/gitdir';
      await params.cli.test('npm-package');
      const req = params.server.popRequest();
      t.equal(
        req.body.target.remoteUrl,
        'http://github.com/snyk/npm-package',
        'git remoteUrl is passed',
      );
      t.equals(
        req.body.target.branch,
        'master',
        'correct branch passed to request',
      );

      delete process.env.GIT_DIR;
    },

    'test npm-package remoteUrl with --remote-repo-url': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      process.env.GIT_DIR = 'npm-package/gitdir';
      await params.cli.test('npm-package', {
        'remote-repo-url': 'foo',
      });
      const req = params.server.popRequest();
      t.equal(
        req.body.target.remoteUrl,
        'foo',
        'specified remoteUrl is passed',
      );
      t.equals(
        req.body.target.branch,
        'master',
        'correct branch passed to request',
      );

      delete process.env.GIT_DIR;
    },

    '`test --file=protect/package.json`': (params) => async (t) => {
      const res = await params.cli.test(getFixturePath('protect'), {
        file: 'package.json',
      });
      t.match(
        res,
        /Tested 1 dependencies for known vulnerabilities/,
        'should succeed in a folder',
      );
    },

    '`test npm-package-policy` returns correct meta': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const commandResult: CommandResult = await params.cli.test(
        'npm-package-policy',
      );
      const res = commandResult.getDisplayResults();
      const meta = res.slice(res.indexOf('Organization:')).split('\n');
      t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
      t.match(meta[1], /Package manager:\s+npm/, 'package manager displayed');
      t.match(meta[2], /Target file:\s+package.json/, 'target file displayed');
      t.match(
        meta[3],
        /Project name:\s+custom-policy-location-package/,
        'project name displayed',
      );
      t.match(meta[4], /Open source:\s+no/, 'open source displayed');
      t.match(meta[5], /Project path:\s+npm-package-policy/, 'path displayed');
      t.match(meta[6], /Local Snyk policy:\s+found/, 'local policy displayed');
    },

    '`test npm-package` sends pkg info': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package');
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;

      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
        'depGraph looks fine',
      );
    },

    '`test npm-package --file=package-lock.json ` sends pkg info': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package', { file: 'package-lock.json' });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
        'depGraph looks fine',
      );
    },

    '`test npm-package --file=package-lock.json --dev` sends pkg info': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package', {
        file: 'package-lock.json',
        dev: true,
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'npm-package@1.0.0',
          'ms@0.7.1',
          'debug@2.2.0',
          'object-assign@4.1.1',
        ].sort(),
        'depGraph looks fine',
      );
    },

    '`test npm-out-of-sync` out of sync fails': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('npm-out-of-sync', { dev: true });
        t.fail('Should fail');
      } catch (e) {
        t.equal(
          e.message,
          '\nTesting npm-out-of-sync...\n\n' +
            'Dependency snyk was not found in package-lock.json.' +
            ' Your package.json and package-lock.json are probably out of sync.' +
            ' Please run "npm install" and try again.',
          'Contains enough info about err',
        );
      }
    },

    '`test npm-out-of-sync --strict-out-of-sync=false` passes': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-out-of-sync', {
        dev: true,
        strictOutOfSync: false,
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'npm-package@1.0.0',
          'object-assign@4.1.1',
          'rewire@^4.0.1',
          'snyk@*',
          'to-array@0.1.4',
        ].sort(),
        'depGraph looks fine',
      );
    },

    '`test npm-package-shrinkwrap --file=package-lock.json` with npm-shrinkwrap errors': (
      params,
      utils,
    ) => async (t) => {
      t.plan(1);
      utils.chdirWorkspaces();
      try {
        await params.cli.test('npm-package-shrinkwrap', {
          file: 'package-lock.json',
        });
        t.fail('Should fail');
      } catch (e) {
        t.includes(
          e.message,
          '--file=package.json',
          'Contains enough info about err',
        );
      }
    },

    '`test npm-package-with-subfolder --file=package-lock.json ` picks top-level files': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package-with-subfolder', {
        file: 'package-lock.json',
      });
      const req = params.server.popRequest();
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package-top-level@1.0.0', 'to-array@0.1.4'].sort(),
        'depGraph looks fine',
      );
    },

    '`test npm-package-with-subfolder --file=subfolder/package-lock.json ` picks subfolder files': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('npm-package-with-subfolder', {
        file: 'subfolder/package-lock.json',
      });
      const req = params.server.popRequest();
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package-subfolder@1.0.0', 'to-array@0.1.4'].sort(),
        'depGraph looks fine',
      );
    },
  },
};
