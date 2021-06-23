import {
  iacTest,
  iacTestJson,
  iacTestSarif,
  iacErrorTest,
  iacTestJsonAssertions,
  iacTestSarifAssertions,
  iacTestSarifFileOutput,
  IacAcceptanceTestType,
} from './cli-test.iac-utils';

import { AcceptanceTests } from '../cli-test.acceptance.test';

/**
 * There's a Super weird bug when referncing Typescript Enum values (i.e. SEVERITY.medium), which causes all the to tests breaks.
 * Probably some bad compatability with the Tap library & Ts-Node for supporting ENUMS.
 *
 * */

export const IacDirTests: AcceptanceTests = {
  language: 'Iac - Directory (Kubernetes)',
  tests: {
    '`iac test directory`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      await params.cli.test('iac-kubernetes/', {
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

    '`iac test directory --severity-threshold=low`': (params, utils) => async (
      t,
    ) =>
      await iacTest(
        t,
        utils,
        params,
        'low',
        3,
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --severity-threshold=medium`': (
      params,
      utils,
    ) => async (t) =>
      await iacTest(
        t,
        utils,
        params,
        'medium',
        2,
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --severity-threshold=high`': (params, utils) => async (
      t,
    ) =>
      await iacTest(
        t,
        utils,
        params,
        'high',
        1,
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --json - no issues`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();
      const testableObject = await params.cli.test('iac-kubernetes/', {
        iac: true,
        json: true,
      });
      const res: any = JSON.parse(testableObject);
      iacTestJsonAssertions(
        t,
        res,
        null,
        false,
        IacAcceptanceTestType.DIRECTORY,
      );
    },
    '`iac test directory --severity-threshold=low --json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestJson(
        t,
        utils,
        params,
        'low',
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --severity-threshold=medium --json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestJson(
        t,
        utils,
        params,
        'medium',
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --severity-threshold=high --json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestJson(
        t,
        utils,
        params,
        'high',
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --sarif - no issues`': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      const testableObject = await params.cli.test('iac-kubernetes/', {
        iac: true,
        sarif: true,
      });
      const res: any = JSON.parse(testableObject);
      iacTestSarifAssertions(t, res, null, false);
    },
    '`iac test directory --severity-threshold=low --sarif`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarif(
        t,
        utils,
        params,
        'low',
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --severity-threshold=medium --sarif`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarif(
        t,
        utils,
        params,
        'medium',
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --severity-threshold=high --sarif`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarif(
        t,
        utils,
        params,
        'high',
        IacAcceptanceTestType.DIRECTORY,
      ),

    '`iac test directory --severity-threshold=high --sarif --sarif-file-output=test.json`': (
      params,
      utils,
    ) => async (t) =>
      await iacTestSarifFileOutput(
        t,
        utils,
        params,
        'high',
        IacAcceptanceTestType.DIRECTORY,
      ),
  },
};
