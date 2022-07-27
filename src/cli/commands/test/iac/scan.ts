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
import { getRepositoryRootForPath } from '../../../../lib/iac/git';
import { getInfo } from '../../../../lib/project-metadata/target-builders/git';
import { buildMeta, GitRepository, GitRepositoryFinder } from './meta';

export async function scan(
  iacOrgSettings: IacOrgSettings,
  options: any,
  testSpinner: ora.Ora | undefined,
  paths: string[],
  orgPublicId: string,
  buildOciRules: () => OciRegistry,
  projectRoot: string,
  remoteRepoUrl?: string,
  targetName?: string,
): Promise<{
  iacOutputMeta: IacOutputMeta | undefined;
  iacScanFailures: IacFileInDirectory[];
  iacIgnoredIssuesCount: number;
  results: any[];
  resultOptions: (Options & TestOptions)[];
}> {
  const results = [] as any[];
  const resultOptions: Array<Options & TestOptions> = [];
  const repositoryFinder = new DefaultGitRepositoryFinder();

  const iacOutputMeta = await buildMeta(
    repositoryFinder,
    iacOrgSettings,
    projectRoot,
    remoteRepoUrl,
    targetName,
  );

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
          throw new CurrentWorkingDirectoryTraversalError(path, projectRoot);
        }

        const resultsProcessor = new SingleGroupResultsProcessor(
          projectRoot,
          orgPublicId,
          iacOrgSettings,
          testOpts,
          iacOutputMeta,
        );

        const { results, failures, ignoreCount } = await iacTest(
          resultsProcessor,
          path,
          testOpts,
          iacOrgSettings,
          rulesOrigin,
        );

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
  public projectRoot: string;

  constructor(path: string, projectRoot: string) {
    super('Path is outside the current working directory');
    this.code = IaCErrorCodes.CurrentWorkingDirectoryTraversalError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `Path is outside the current working directory`;
    this.filename = path;
    this.projectRoot = projectRoot;
  }
}

class DefaultGitRepository implements GitRepository {
  constructor(public readonly path: string) {}

  async readRemoteUrl() {
    const gitInfo = await getInfo({
      isFromContainer: false,
      cwd: this.path,
    });
    return gitInfo?.remoteUrl;
  }
}

class DefaultGitRepositoryFinder implements GitRepositoryFinder {
  async findRepositoryForPath(path: string) {
    try {
      return new DefaultGitRepository(getRepositoryRootForPath(path));
    } catch {
      return;
    }
  }
}
