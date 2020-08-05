import * as _ from '@snyk/lodash';
import {
  iacTest,
  iacTestJson,
  iacErrorTest,
  iacTestMetaAssertions,
  iacTestJsonAssertions,
  iacTestResponseFixturesByThreshold,
} from './cli-test.iac-k8s.utils';
import { CommandResult } from '../../../src/cli/commands/types';

import { AcceptanceTests } from './cli-test.acceptance.test';

/**
 * There's a Super weird bug when referncing Typescript Enum values (i.e. SEVERITY.medium), which causes all the to tests breaks.
 * Probably some bad compatability with the Tap library & Ts-Node for supporting ENUMS.
 * */

export const IacK8sTests: AcceptanceTests = {
  language: 'Iac (Kubernetes)',
  tests: {
    '`iac test multi-file.yaml --json - no issues`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const commandResult: CommandResult = await params.cli.test(
        'iac-kubernetes/multi-file.yaml',
        {
          iac: true,
        },
      );
      const res: any = JSON.parse((commandResult as any).jsonResult);
      iacTestJsonAssertions(t, res, null, false);
    },
    '`iac test multi.yaml - no issues`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      await params.cli.test('iac-kubernetes/multi-file.yaml', {
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

    '`iac test - no file`': (params, utils) => async (t) =>
      await iacErrorTest(
        t,
        utils,
        params,
        'iac-kubernetes',
        'iac test option currently supports only a single local file',
      ),

    '`iac test - not a real dir`': (params, utils) => async (t) =>
      await iacErrorTest(
        t,
        utils,
        params,
        'nonono',
        'iac test option currently supports only a single local file',
      ),

    '`iac test multi-file.yaml meta - no issues': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const commandResult: CommandResult = await params.cli.test(
        'iac-kubernetes/multi-file.yaml',
        {
          iac: true,
        },
      );
      const res = commandResult.getDisplayResults();
      iacTestMetaAssertions(t, res);
    },

    '`iac test multi-file.yaml`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      params.server.setNextResponse(iacTestResponseFixturesByThreshold['low']);

      try {
        await params.cli.test('iac-kubernetes/multi-file.yaml', {
          iac: true,
        });
        t.fail('should have thrown');
      } catch (err) {
        const res = err.message;

        t.match(
          res,
          'Tested iac-kubernetes/multi-file.yaml for known issues, found 3 issues',
          '3 issue',
        );

        const issues = res
          .slice(
            res.indexOf('Infrastructure as code issues:'),
            res.indexOf('Organization:'),
          )
          .split('\n');
        t.ok(issues[1].includes('[SNYK-CC-K8S-'), 'Snyk id');
        t.ok(
          issues[2].trim().startsWith('introduced by'),
          'Introduced by line',
        );
        t.ok(issues[3], 'description');
        t.ok(issues[4] === '', 'Empty line after description');
        t.ok(issues[5].includes('[SNYK-CC-K8S-'), 'Snyk id');
        t.ok(
          issues[6].trim().startsWith('introduced by'),
          'Introduced by line',
        );
        t.ok(issues[7], 'description');
        t.ok(issues[8] === '', 'Empty line after description');
        iacTestMetaAssertions(t, res);
      }
    },
    '`iac test multi-file.yaml --severity-threshold=low`': (
      params,
      utils,
    ) => async (t) => await iacTest(t, utils, params, 'low', 3),

    '`iac test multi-file.yaml --severity-threshold=medium`': (
      params,
      utils,
    ) => async (t) => await iacTest(t, utils, params, 'medium', 2),

    '`iac test multi-file.yaml --severity-threshold=high`': (
      params,
      utils,
    ) => async (t) => await iacTest(t, utils, params, 'high', 1),

    '`iac test multi-file.yaml --severity-threshold=low --json`': (
      params,
      utils,
    ) => async (t) => await iacTestJson(t, utils, params, 'low'),

    '`iac test multi-file.yaml --severity-threshold=medium --json`': (
      params,
      utils,
    ) => async (t) => await iacTestJson(t, utils, params, 'medium'),

    '`iac test multi-file.yaml --severity-threshold=high --json`': (
      params,
      utils,
    ) => async (t) => await iacTestJson(t, utils, params, 'high'),
  },
};
