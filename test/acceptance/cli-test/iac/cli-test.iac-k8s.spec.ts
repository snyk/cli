import {
  iacTest,
  iacTestJson,
  iacTestSarif,
  iacErrorTest,
  iacTestMetaAssertions,
  iacTestJsonAssertions,
  iacTestSarifAssertions,
  iacTestResponseFixturesByThreshold,
  iacTestSarifFileOutput,
  IacAcceptanceTestType,
} from './cli-test.iac-utils';
import { CommandResult } from '../../../../src/cli/commands/types';

import { AcceptanceTests } from '../cli-test.acceptance.test';

/**
 * There's a Super weird bug when referncing Typescript Enum values (i.e. SEVERITY.medium), which causes all the to tests breaks.
 * Probably some bad compatability with the Tap library & Ts-Node for supporting ENUMS.
 *
 * */

export const IacK8sTests: AcceptanceTests = {
  language: 'Iac (Kubernetes)',
  tests: {
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
      iacTestMetaAssertions(t, res, IacAcceptanceTestType.SINGLE_K8S_FILE);
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
          'Tested multi-file.yaml for known issues, found 3 issues',
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
        t.ok(issues[3] === '', 'description');
        t.ok(issues[4].includes('[SNYK-CC-K8S-'), 'Snyk id');
        t.ok(
          issues[5].trim().startsWith('introduced by'),
          'Introduced by line',
        );
        t.ok(issues[6] === '', 'Empty line after description');
        iacTestMetaAssertions(t, res, IacAcceptanceTestType.SINGLE_K8S_FILE);
      }
    },
    '`iac test multi-file.yaml --severity-threshold=low`': (
      params,
      utils,
    ) => async (t) =>
      await iacTest(
        t,
        utils,
        params,
        'low',
        3,
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --severity-threshold=medium`': (
      params,
      utils,
    ) => async (t) =>
      await iacTest(
        t,
        utils,
        params,
        'medium',
        2,
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --severity-threshold=high`': (
      params,
      utils,
    ) => async (t) =>
      await iacTest(
        t,
        utils,
        params,
        'high',
        1,
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --json - no issues`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const testableObject = await params.cli.test(
        'iac-kubernetes/multi-file.yaml',
        {
          iac: true,
          json: true,
        },
      );
      const res: any = JSON.parse(testableObject);
      iacTestJsonAssertions(
        t,
        res,
        null,
        false,
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      );
    },
    '`iac test multi-file.yaml --severity-threshold=low --json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestJson(
        t,
        utils,
        params,
        'low',
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --severity-threshold=medium --json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestJson(
        t,
        utils,
        params,
        'medium',
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --severity-threshold=high --json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestJson(
        t,
        utils,
        params,
        'high',
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --sarif - no issues`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const testableObject = await params.cli.test(
        'iac-kubernetes/multi-file.yaml',
        {
          iac: true,
          sarif: true,
        },
      );
      const res: any = JSON.parse(testableObject);
      iacTestSarifAssertions(t, res, null, false);
    },
    '`iac test multi-file.yaml --severity-threshold=low --sarif`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarif(
        t,
        utils,
        params,
        'low',
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --severity-threshold=medium --sarif`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarif(
        t,
        utils,
        params,
        'medium',
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --severity-threshold=high --sarif`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarif(
        t,
        utils,
        params,
        'high',
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),

    '`iac test multi-file.yaml --severity-threshold=high --sarif --sarif-file-output=test.json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarifFileOutput(
        t,
        utils,
        params,
        'high',
        IacAcceptanceTestType.SINGLE_K8S_FILE,
      ),
  },
};
