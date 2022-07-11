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
import { spinnerMessage } from '../../../../lib/formatters/iac-output';

import { test as iacTest } from './local-execution';
import { assertIaCOptionsFlags } from './local-execution/assert-iac-options-flag';
import { initRules } from './local-execution/rules/rules';
import { cleanLocalCache } from './local-execution/measurable-methods';
import * as ora from 'ora';
import { IaCErrorCodes, IacOrgSettings } from './local-execution/types';
import * as pathLib from 'path';
import { CustomError } from '../../../../lib/errors';
import { OciRegistry } from './local-execution/rules/oci-registry';
import { SingleGroupResultsProcessor } from './local-execution/process-results';
import { getErrorStringCode } from './local-execution/error-utils';

export async function scan(
  iacOrgSettings: IacOrgSettings,
  options: any,
  testSpinner: ora.Ora | undefined,
  paths: string[],
  orgPublicId: string,
  buildOciRules: () => OciRegistry,
  projectRoot: string,
): Promise<{
  iacOutputMeta: IacOutputMeta | undefined;
  iacScanFailures: IacFileInDirectory[];
  iacIgnoredIssuesCount: number;
  results: any[];
  resultOptions: (Options & TestOptions)[];
}> {
  const results = [] as any[];
  const resultOptions: Array<Options & TestOptions> = [];

  let iacOutputMeta: IacOutputMeta | undefined;
  let iacScanFailures: IacFileInDirectory[] = [];
  let iacIgnoredIssuesCount = 0;

  try {
    const rulesOrigin = await initRules(
      buildOciRules,
      iacOrgSettings,
      options,
      orgPublicId,
    );

    testSpinner?.start(spinnerMessage);

    for (const path of paths) {
      // Create a copy of the options so a specific test can
      // modify them i.e. add `options.file` etc. We'll need
      // these options later.
      const testOpts = cloneDeep(options);
      testOpts.path = path;
      testOpts.projectName = testOpts['project-name'];

      let res: (TestResult | TestResult[]) | Error;
      try {
        assertIaCOptionsFlags(process.argv);

        if (pathLib.relative(projectRoot, path).includes('..')) {
          throw new CurrentWorkingDirectoryTraversalError(path);
        }

        const resultsProcessor = new SingleGroupResultsProcessor(
          projectRoot,
          orgPublicId,
          iacOrgSettings,
          testOpts,
        );

        const { results, failures, ignoreCount } = await iacTest(
          resultsProcessor,
          path,
          testOpts,
          iacOrgSettings,
          rulesOrigin,
        );
        iacOutputMeta = {
          orgName: results[0]?.org,
          projectName: results[0]?.projectName,
          gitRemoteUrl: results[0]?.meta?.gitRemoteUrl,
        };

        res = results;
        iacScanFailures = [...iacScanFailures, ...(failures || [])];
        iacIgnoredIssuesCount += ignoreCount;
      } catch (error) {
        res = formatTestError(error);
      }

      // Not all test results are arrays in order to be backwards compatible
      // with scripts that use a callback with test. Coerce results/errors to be arrays
      // and add the result options to each to be displayed
      const resArray: any[] = Array.isArray(res) ? res : [res];

      for (let i = 0; i < resArray.length; i++) {
        const pathWithOptionalProjectName =
          resArray[i].filename ||
          utils.getPathWithOptionalProjectName(path, resArray[i]);
        results.push(
          assign(resArray[i], { path: pathWithOptionalProjectName }),
        );
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
    }
  } finally {
    cleanLocalCache();
  }

  return {
    iacOutputMeta,
    iacScanFailures,
    iacIgnoredIssuesCount,
    results,
    resultOptions,
  };
}

// This is a duplicate of  commands/test/format-test-error.ts
// we wanted to adjust it and check the case we send errors in an Array
function formatTestError(error) {
  let errorResponse;
  if (error instanceof Error) {
    errorResponse = error;
  } else if (Array.isArray(error)) {
    return error.map(formatTestError);
  } else if (typeof error !== 'object') {
    errorResponse = new Error(error);
  } else {
    try {
      errorResponse = JSON.parse(error.message);
    } catch (unused) {
      errorResponse = error;
    }
  }
  return errorResponse;
}

class CurrentWorkingDirectoryTraversalError extends CustomError {
  public filename: string;

  constructor(path: string) {
    super('Path is outside the current working directory');
    this.code = IaCErrorCodes.CurrentWorkingDirectoryTraversalError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `Path is outside the current working directory`;
    this.filename = path;
  }
}
