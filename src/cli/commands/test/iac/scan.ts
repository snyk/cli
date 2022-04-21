import * as cloneDeep from 'lodash.clonedeep';
import * as assign from 'lodash.assign';
import {
  IacFileInDirectory,
  IacOutputMeta,
  Options,
  TestOptions,
} from '../../../../lib/types';
import { TestResult } from '../../../../lib/snyk-test/legacy';
import * as utils from '../utils';
import { test as iacTest } from './local-execution';
import { formatTestError } from '../format-test-error';
import { initRules } from './local-execution/rules';
import { cleanLocalCache } from './local-execution/measurable-methods';
import { IacOrgSettings, RulesOrigin } from './local-execution/types';

export async function initRulesAndScanPaths(
  options: any,
  paths: string[],
  orgPublicId: string,
  iacOrgSettings: IacOrgSettings,
) {
  const rulesOrigin = await initRules(iacOrgSettings, options);
  try {
    return await scanPaths(
      options,
      paths,
      orgPublicId,
      iacOrgSettings,
      rulesOrigin,
    );
  } finally {
    cleanLocalCache();
  }
}

async function scanPaths(
  options: any,
  paths: string[],
  orgPublicId: string,
  iacOrgSettings: IacOrgSettings,
  rulesOrigin: RulesOrigin,
) {
  const resultOptions: Array<Options & TestOptions> = [];
  const results = [] as any[];

  let iacScanFailures: IacFileInDirectory[] | undefined;
  let iacIgnoredIssuesCount = 0;
  let iacOutputMeta: IacOutputMeta | undefined;

  for (const path of paths) {
    const scanResult = await scanPath(
      options,
      path,
      orgPublicId,
      iacOrgSettings,
      rulesOrigin,
    );

    iacOutputMeta = scanResult.iacOutputMeta;
    iacScanFailures = scanResult.iacScanFailures;
    iacIgnoredIssuesCount += scanResult.iacIgnoredIssuesCount;

    results.push(...scanResult.results);
    resultOptions.push(...scanResult.resultOptions);
  }

  return {
    results,
    resultOptions,
    iacScanFailures,
    iacIgnoredIssuesCount,
    iacOutputMeta,
  };
}

async function scanPath(
  options: any,
  path: string,
  orgPublicId: string,
  iacOrgSettings: IacOrgSettings,
  rulesOrigin: RulesOrigin,
) {
  const resultOptions: Array<Options & TestOptions> = [];
  const results = [] as any[];

  let iacScanFailures: IacFileInDirectory[] | undefined;
  let iacIgnoredIssuesCount = 0;
  let iacOutputMeta: IacOutputMeta | undefined;

  // Create a copy of the options so a specific test can
  // modify them i.e. add `options.file` etc. We'll need
  // these options later.
  const testOpts = cloneDeep(options);
  testOpts.path = path;
  testOpts.projectName = testOpts['project-name'];

  let res: (TestResult | TestResult[]) | Error;
  try {
    const { results, failures, ignoreCount } = await iacTest(
      path,
      testOpts,
      orgPublicId,
      iacOrgSettings,
      rulesOrigin,
    );

    iacOutputMeta = {
      orgName: results[0]?.org,
      projectName: results[0]?.projectName,
      gitRemoteUrl: results[0]?.meta?.gitRemoteUrl,
    };

    res = results;
    iacScanFailures = failures;
    iacIgnoredIssuesCount += ignoreCount;
  } catch (error) {
    // not throwing here but instead returning error response
    // for legacy flow reasons.
    res = formatTestError(error);
  }

  // Not all test results are arrays in order to be backwards compatible
  // with scripts that use a callback with test. Coerce results/errors to be arrays
  // and add the result options to each to be displayed
  const resArray: any[] = Array.isArray(res) ? res : [res];

  for (let i = 0; i < resArray.length; i++) {
    const pathWithOptionalProjectName = utils.getPathWithOptionalProjectName(
      path,
      resArray[i],
    );
    results.push(assign(resArray[i], { path: pathWithOptionalProjectName }));
    // currently testOpts are identical for each test result returned even if it's for multiple projects.
    // we want to return the project names, so will need to be crafty in a way that makes sense.
    if (!testOpts.projectNames) {
      resultOptions.push(testOpts);
    } else {
      resultOptions.push(
        assign(cloneDeep(testOpts), {
          projectName: testOpts.projectNames[i],
        }),
      );
    }
  }

  return {
    results,
    resultOptions,
    iacOutputMeta,
    iacScanFailures,
    iacIgnoredIssuesCount,
  };
}
