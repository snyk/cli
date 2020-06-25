import * as sinon from 'sinon';
import * as _ from '@snyk/lodash';
import { getWorkspaceJSON } from '../workspace-helper';
import { CommandResult } from '../../../src/cli/commands/types';
// import * as fs from 'fs';
// import * as path from 'path';

import { AcceptanceTests } from './cli-test.acceptance.test';

export const IacK8sTests: AcceptanceTests = {
  language: 'Iac (Kubernetes)',
  tests: {
    '`iac test --file=multi.yaml - no issues`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();

      await params.cli.test('iac-kubernetes', {
        file: 'multi-file.yaml',
        iac: true,
      });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-iac', 'posts to correct url');
      t.equal(req.body.type, 'k8sconfig');
    },

    '`iac test - no --file`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      try {
        await params.cli.test('iac-kubernetes', {
          iac: true,
        });
        t.fail('should have failed');
      } catch (err) {
        t.pass('throws err');
        t.match(
          err.message,
          'iac option works only with specified files',
          'shows err',
        );
      }
    },

    '`iac test - not a real dir`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      try {
        await params.cli.test('nonono', {
          iac: true,
        });
        t.fail('should have failed');
      } catch (err) {
        t.pass('throws err');
        t.match(
          err.message,
          "iac option doesn't support lookup as repo",
          'shows err',
        );
      }
    },

    '`iac test --file=multi.yaml meta - no issues': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const commandResult: CommandResult = await params.cli.test(
        'iac-kubernetes',
        {
          file: 'multi-file.yaml',
          iac: true,
        },
      );
      const res = commandResult.getDisplayResults();

      const meta = res.slice(res.indexOf('Organization:')).split('\n');
      t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
      t.match(
        meta[1],
        /Package manager:\s+k8sconfig/,
        'package manager displayed',
      );
      t.match(
        meta[2],
        /Target file:\s+multi-file.yaml/,
        'target file displayed',
      );
      t.match(
        meta[3],
        /Project name:\s+iac-kubernetes/,
        'project name displayed',
      );
      t.match(meta[4], /Open source:\s+no/, 'open source displayed');
      t.match(meta[5], /Project path:\s+iac-kubernetes/, 'path displayed');
      t.notMatch(
        meta[5],
        /Local Snyk policy:\s+found/,
        'local policy not displayed',
      );
    },

    '`iac test --file=multi.yaml`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('iac-kubernetes', 'test-iac-result.json'),
      );

      try {
        await params.cli.test('iac-kubernetes', {
          file: 'multi-file.yaml',
          iac: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const res = err.message;

        t.match(
          res,
          'Tested 0 dependencies for known issues, found 3 issues',
          '3 issue',
        );

        const meta = res.slice(res.indexOf('Organization:')).split('\n');
        t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
        t.match(
          meta[1],
          /Package manager:\s+k8sconfig/,
          'package manager displayed',
        );
        t.match(
          meta[2],
          /Target file:\s+multi-file.yaml/,
          'target file displayed',
        );
        t.match(
          meta[3],
          /Project name:\s+iac-kubernetes/,
          'project name displayed',
        );
        t.match(meta[4], /Open source:\s+no/, 'open source displayed');
        t.match(meta[5], /Project path:\s+iac-kubernetes/, 'path displayed');
        t.notMatch(
          meta[5],
          /Local Snyk policy:\s+found/,
          'local policy not displayed',
        );
      }
    },

    '`iac test --file=multi.yaml --severity-threshold=low`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('iac-kubernetes', 'test-iac-result.json'),
      );

      try {
        await params.cli.test('iac-kubernetes', {
          file: 'multi-file.yaml',
          iac: true,
          severityThreshold: 'low',
        });
        t.fail('should have thrown');
      } catch (err) {
        const res = err.message;

        t.match(
          res,
          'Tested 0 dependencies for known issues, found 3 issues',
          '3 issue',
        );

        const meta = res.slice(res.indexOf('Organization:')).split('\n');
        t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
        t.match(
          meta[1],
          /Package manager:\s+k8sconfig/,
          'package manager displayed',
        );
        t.match(
          meta[2],
          /Target file:\s+multi-file.yaml/,
          'target file displayed',
        );
        t.match(
          meta[3],
          /Project name:\s+iac-kubernetes/,
          'project name displayed',
        );
        t.match(meta[4], /Open source:\s+no/, 'open source displayed');
        t.match(meta[5], /Project path:\s+iac-kubernetes/, 'path displayed');
        t.notMatch(
          meta[5],
          /Local Snyk policy:\s+found/,
          'local policy not displayed',
        );
      }
    },

    '`iac test --file=multi.yaml --severity-threshold=low --json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('iac-kubernetes', 'test-iac-result.json'),
      );

      try {
        await params.cli.test('iac-kubernetes', {
          file: 'multi-file.yaml',
          iac: true,
          severityThreshold: 'low',
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'low');

        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'iac-kubernetes',
          'test-iac-result.json',
        );

        t.deepEqual(res.org, 'test-org', 'org is ok');
        t.deepEqual(res.projectType, 'k8sconfig', 'projectType is ok');
        t.deepEqual(res.path, 'iac-kubernetes', 'path is ok');
        t.deepEqual(res.projectName, 'iac-kubernetes', 'projectName is ok');
        t.deepEqual(res.targetFile, 'multi-file.yaml', 'targetFile is ok');
        t.deepEqual(res.dependencyCount, 0, 'dependencyCount is 0');
        t.deepEqual(res.vulnerabilities, [], 'vulnerabilities is empty');

        t.deepEqual(
          _.sortBy(res.cloudConfigResults, 'id'),
          _.sortBy(expected.result.cloudConfigResults, 'id'),
          'issues are the same',
        );
      }
    },

    '`iac test --file=multi.yaml --severity-threshold=medium`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('iac-kubernetes', 'test-iac-medium-result.json'),
      );

      try {
        await params.cli.test('iac-kubernetes', {
          file: 'multi-file.yaml',
          iac: true,
          severityThreshold: 'medium',
        });
        t.fail('should have thrown');
      } catch (err) {
        const res = err.message;

        t.match(
          res,
          'Tested 0 dependencies for known issues, found 2 issues',
          '2 issue',
        );

        const meta = res.slice(res.indexOf('Organization:')).split('\n');
        t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
        t.match(
          meta[1],
          /Package manager:\s+k8sconfig/,
          'package manager displayed',
        );
        t.match(
          meta[2],
          /Target file:\s+multi-file.yaml/,
          'target file displayed',
        );
        t.match(
          meta[3],
          /Project name:\s+iac-kubernetes/,
          'project name displayed',
        );
        t.match(meta[4], /Open source:\s+no/, 'open source displayed');
        t.match(meta[5], /Project path:\s+iac-kubernetes/, 'path displayed');
        t.notMatch(
          meta[5],
          /Local Snyk policy:\s+found/,
          'local policy not displayed',
        );
      }
    },

    '`iac test --file=multi.yaml --severity-threshold=medium --json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('iac-kubernetes', 'test-iac-medium-result.json'),
      );

      try {
        await params.cli.test('iac-kubernetes', {
          file: 'multi-file.yaml',
          iac: true,
          severityThreshold: 'medium',
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'medium');

        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'iac-kubernetes',
          'test-iac-medium-result.json',
        );

        t.deepEqual(res.org, 'test-org', 'org is ok');
        t.deepEqual(res.projectType, 'k8sconfig', 'projectType is ok');
        t.deepEqual(res.path, 'iac-kubernetes', 'path is ok');
        t.deepEqual(res.projectName, 'iac-kubernetes', 'projectName is ok');
        t.deepEqual(res.targetFile, 'multi-file.yaml', 'targetFile is ok');
        t.deepEqual(res.dependencyCount, 0, 'dependencyCount is 0');
        t.deepEqual(res.vulnerabilities, [], 'vulnerabilities is empty');

        t.deepEqual(
          _.sortBy(res.cloudConfigResults, 'id'),
          _.sortBy(expected.result.cloudConfigResults, 'id'),
          'issues are the same',
        );
      }
    },

    '`iac test --file=multi.yaml --severity-threshold=high`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('iac-kubernetes', 'test-iac-high-result.json'),
      );

      try {
        await params.cli.test('iac-kubernetes', {
          file: 'multi-file.yaml',
          iac: true,
          severityThreshold: 'high',
        });
        t.fail('should have thrown');
      } catch (err) {
        const res = err.message;

        t.match(
          res,
          'Tested 0 dependencies for known issues, found 1 issues',
          '1 issue',
        );

        const meta = res.slice(res.indexOf('Organization:')).split('\n');
        t.match(meta[0], /Organization:\s+test-org/, 'organization displayed');
        t.match(
          meta[1],
          /Package manager:\s+k8sconfig/,
          'package manager displayed',
        );
        t.match(
          meta[2],
          /Target file:\s+multi-file.yaml/,
          'target file displayed',
        );
        t.match(
          meta[3],
          /Project name:\s+iac-kubernetes/,
          'project name displayed',
        );
        t.match(meta[4], /Open source:\s+no/, 'open source displayed');
        t.match(meta[5], /Project path:\s+iac-kubernetes/, 'path displayed');
        t.notMatch(
          meta[5],
          /Local Snyk policy:\s+found/,
          'local policy not displayed',
        );
      }
    },

    '`iac test --file=multi.yaml --severity-threshold=high --json`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(
        getWorkspaceJSON('iac-kubernetes', 'test-iac-high-result.json'),
      );

      try {
        await params.cli.test('iac-kubernetes', {
          file: 'multi-file.yaml',
          iac: true,
          severityThreshold: 'high',
          json: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const req = params.server.popRequest();
        t.is(req.query.severityThreshold, 'high');

        const res = JSON.parse(err.message);

        const expected = getWorkspaceJSON(
          'iac-kubernetes',
          'test-iac-high-result.json',
        );

        t.deepEqual(res.org, 'test-org', 'org is ok');
        t.deepEqual(res.projectType, 'k8sconfig', 'projectType is ok');
        t.deepEqual(res.path, 'iac-kubernetes', 'path is ok');
        t.deepEqual(res.projectName, 'iac-kubernetes', 'projectName is ok');
        t.deepEqual(res.targetFile, 'multi-file.yaml', 'targetFile is ok');
        t.deepEqual(res.dependencyCount, 0, 'dependencyCount is 0');
        t.deepEqual(res.vulnerabilities, [], 'vulnerabilities is empty');

        t.deepEqual(
          _.sortBy(res.cloudConfigResults, 'id'),
          _.sortBy(expected.result.cloudConfigResults, 'id'),
          'issues are the same',
        );
      }
    },

    '`iac test --file=multi.yaml --json - no issues`': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const commandResult: CommandResult = await params.cli.test(
        'iac-kubernetes',
        {
          file: 'multi-file.yaml',
          iac: true,
        },
      );
      const res: any = JSON.parse((commandResult as any).jsonResult);

      t.deepEqual(res.org, 'test-org', 'org is ok');
      t.deepEqual(res.projectType, 'k8sconfig', 'projectType is ok');
      t.deepEqual(res.path, 'iac-kubernetes', 'path is ok');
      t.deepEqual(res.projectName, 'iac-kubernetes', 'projectName is ok');
      t.deepEqual(res.targetFile, 'multi-file.yaml', 'targetFile is ok');
      t.deepEqual(res.dependencyCount, 0, 'dependencyCount is 0');
      t.deepEqual(res.vulnerabilities, [], 'vulnerabilities is empty');
    },
  },
};
