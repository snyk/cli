import * as Debug from 'debug';
import { EOL } from 'os';
import * as cloneDeep from 'lodash.clonedeep';
import * as assign from 'lodash.assign';
import chalk from 'chalk';
import { MissingArgError } from '../../../../lib/errors';

import {
  IacFileInDirectory,
  IacOutputMeta,
  Options,
  TestOptions,
} from '../../../../lib/types';
import { MethodArgs } from '../../../args';
import { TestCommandResult } from '../../../commands/types';
import {
  LegacyVulnApiResult,
  TestResult,
} from '../../../../lib/snyk-test/legacy';
import { mapIacTestResult } from '../../../../lib/snyk-test/iac-test-result';

import {
  summariseErrorResults,
  summariseVulnerableResults,
} from '../../../../lib/formatters';
import * as utils from '../utils';
import {
  formatIacTestFailures,
  getIacDisplayErrorFileOutput,
  iacTestTitle,
  shouldLogUserMessages,
  spinnerFailureMessage,
  spinnerMessage,
  spinnerSuccessMessage,
} from '../../../../lib/formatters/iac-output';
import { getEcosystemForTest, testEcosystem } from '../../../../lib/ecosystems';
import { extractDataToSendFromResults } from '../../../../lib/formatters/test/format-test-results';

import { test as iacTest } from './local-execution';
import { validateCredentials } from '../validate-credentials';
import { validateTestOptions } from '../validate-test-options';
import { setDefaultTestOptions } from '../set-default-test-options';
import { processCommandArgs } from '../../process-command-args';
import { formatTestError } from '../format-test-error';
import { displayResult } from '../../../../lib/formatters/test/display-result';
import * as analytics from '../../../../lib/analytics';

import {
  getPackageJsonPathsContainingSnykDependency,
  getProtectUpgradeWarningForPaths,
} from '../../../../lib/protect-update-notification';
import {
  containsSpotlightVulnIds,
  notificationForSpotlightVulns,
} from '../../../../lib/spotlight-vuln-notification';
import { isIacShareResultsOptions } from './local-execution/assert-iac-options-flag';
import { assertIaCOptionsFlags } from './local-execution/assert-iac-options-flag';
import { hasFeatureFlag } from '../../../../lib/feature-flags';
import {
  formatIacTestSummary,
  formatShareResultsOutput,
  getIacDisplayedIssues,
} from '../../../../lib/formatters/iac-output';
import { initRules } from './local-execution/rules';
import {
  cleanLocalCache,
  getIacOrgSettings,
} from './local-execution/measurable-methods';
import config from '../../../../lib/config';
import { UnsupportedEntitlementError } from '../../../../lib/errors/unsupported-entitlement-error';
import { failuresTipOutput } from '../../../../lib/formatters/iac-output';
import * as ora from 'ora';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

// TODO: avoid using `as any` whenever it's possible

// The hardcoded `isReportCommand` argument is temporary and will be removed together with the `snyk iac report` command deprecation
export default async function(
  isReportCommand: boolean,
  ...args: MethodArgs
): Promise<TestCommandResult> {
  const { options: originalOptions, paths } = processCommandArgs(...args);

  const options = setDefaultTestOptions(originalOptions);
  validateTestOptions(options);
  validateCredentials(options);

  const packageJsonPathsWithSnykDepForProtect: string[] = getPackageJsonPathsContainingSnykDependency(
    options.file,
    paths,
  );

  analytics.add(
    'upgradable-snyk-protect-paths',
    packageJsonPathsWithSnykDepForProtect.length,
  );

  // Handles no image arg provided to the container command until
  // a validation interface is implemented in the docker plugin.
  if (options.docker && paths.length === 0) {
    throw new MissingArgError();
  }

  const ecosystem = getEcosystemForTest(options);
  if (ecosystem) {
    try {
      const commandResult = await testEcosystem(ecosystem, paths, options);
      return commandResult;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(String(error));
      }
    }
  }

  let testSpinner: ora.Ora | undefined;

  const resultOptions: Array<Options & TestOptions> = [];
  const results = [] as any[];

  // Holds an array of scanned file metadata for output.
  let iacScanFailures: IacFileInDirectory[] | undefined;
  let iacIgnoredIssuesCount = 0;
  let iacOutputMeta: IacOutputMeta | undefined;

  const isNewIacOutputSupported = await hasFeatureFlag('iacCliOutput', options);

  if (shouldLogUserMessages(options, isNewIacOutputSupported)) {
    console.log(EOL + iacTestTitle + EOL);

    testSpinner = ora({ isSilent: options.quiet, stream: process.stdout });
  }

  const orgPublicId = (options.org as string) ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);

  if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
    throw new UnsupportedEntitlementError('infrastructureAsCode');
  }

  try {
    testSpinner?.start(spinnerMessage);

    const rulesOrigin = await initRules(iacOrgSettings, options);

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

  const vulnerableResults = results.filter(
    (res) =>
      (res.vulnerabilities && res.vulnerabilities.length) ||
      (res.result &&
        res.result.cloudConfigResults &&
        res.result.cloudConfigResults.length),
  );
  const errorResults = results.filter((res) => res instanceof Error);
  const notSuccess = errorResults.length > 0;
  const foundVulnerabilities = vulnerableResults.length > 0;

  if (notSuccess) {
    testSpinner?.fail(spinnerFailureMessage + EOL);
  } else {
    testSpinner?.succeed(spinnerSuccessMessage);
  }

  // resultOptions is now an array of 1 or more options used for
  // the tests results is now an array of 1 or more test results
  // values depend on `options.json` value - string or object
  const mappedResults = results.map(mapIacTestResult);

  const {
    stdout: dataToSend,
    stringifiedData,
    stringifiedJsonData,
    stringifiedSarifData,
  } = extractDataToSendFromResults(results, mappedResults, options);

  if (options.json || options.sarif) {
    // if all results are ok (.ok == true)
    if (mappedResults.every((res) => res.ok)) {
      return TestCommandResult.createJsonTestCommandResult(
        stringifiedData,
        stringifiedJsonData,
        stringifiedSarifData,
      );
    }

    const err = new Error(stringifiedData) as any;

    if (foundVulnerabilities) {
      err.code = 'VULNS';
      const dataToSendNoVulns = dataToSend;
      delete dataToSendNoVulns.vulnerabilities;
      err.jsonNoVulns = dataToSendNoVulns;
    }

    if (notSuccess) {
      // Take the code of the first problem to go through error
      // translation.
      // Note: this is done based on the logic done below
      // for non-json/sarif outputs, where we take the code of
      // the first error.
      err.code = errorResults[0].code;
    }
    err.json = stringifiedData;
    err.jsonStringifiedResults = stringifiedJsonData;
    err.sarifStringifiedResults = stringifiedSarifData;
    throw err;
  }

  let response = '';

  if (isNewIacOutputSupported && !notSuccess) {
    response += EOL + getIacDisplayedIssues(results, iacOutputMeta!);
  } else {
    response += results
      .map((result, i) => {
        return displayResult(
          results[i] as LegacyVulnApiResult,
          {
            ...resultOptions[i],
          },
          result.foundProjectCount,
        );
      })
      .join(`\n${SEPARATOR}`);
  }

  if (notSuccess) {
    debug(`Failed to test ${errorResults.length} projects, errors:`);
    errorResults.forEach((err) => {
      const errString = err.stack ? err.stack.toString() : err.toString();
      debug('error: %s', errString);
    });
  }

  let summaryMessage = '';
  let errorResultsLength = errorResults.length;

  if (iacScanFailures?.length) {
    errorResultsLength = iacScanFailures.length || errorResults.length;

    response += isNewIacOutputSupported
      ? EOL.repeat(2) + formatIacTestFailures(iacScanFailures)
      : iacScanFailures
          .map((reason) => chalk.bold.red(getIacDisplayErrorFileOutput(reason)))
          .join('');
  }

  if (!notSuccess && iacOutputMeta && isNewIacOutputSupported) {
    response += `${EOL}${SEPARATOR}${EOL}`;

    const iacTestSummary = `${formatIacTestSummary(
      {
        results,
        failures: iacScanFailures,
        ignoreCount: iacIgnoredIssuesCount,
      },
      iacOutputMeta,
    )}`;

    response += iacTestSummary;
  }

  if (results.length > 1) {
    if (isNewIacOutputSupported) {
      response += errorResultsLength ? EOL.repeat(2) + failuresTipOutput : '';
    } else {
      const projects = results.length === 1 ? 'project' : 'projects';
      summaryMessage +=
        `\n\n\nTested ${results.length} ${projects}` +
        summariseVulnerableResults(vulnerableResults, options) +
        summariseErrorResults(errorResultsLength) +
        '\n';
    }
  }

  if (notSuccess) {
    response += chalk.bold.red(summaryMessage);
    const error = new Error(response) as any;
    // take the code of the first problem to go through error
    // translation
    // HACK as there can be different errors, and we pass only the
    // first one
    error.code = errorResults[0].code;
    error.userMessage = errorResults[0].userMessage;
    error.strCode = errorResults[0].strCode;
    throw error;
  }

  if (foundVulnerabilities) {
    response += chalk.bold.red(summaryMessage);

    response += EOL + EOL;
    const foundSpotlightVulnIds = containsSpotlightVulnIds(results);
    const spotlightVulnsMsg = notificationForSpotlightVulns(
      foundSpotlightVulnIds,
    );
    response += spotlightVulnsMsg;

    if (isIacShareResultsOptions(options)) {
      response += formatShareResultsOutput(iacOutputMeta!) + EOL.repeat(2);
      if (isReportCommand) {
        response += chalk.red.bold(
          'Warning:' +
            EOL +
            "We will be deprecating support for the 'snyk iac report' command by mid-June and 'snyk iac test --report' will become the default command for using our share results functionality.",
        );
      }
    }

    const error = new Error(response) as any;
    // take the code of the first problem to go through error
    // translation
    // HACK as there can be different errors, and we pass only the
    // first one
    error.code = vulnerableResults[0].code || 'VULNS';
    error.userMessage = vulnerableResults[0].userMessage;
    error.jsonStringifiedResults = stringifiedJsonData;
    error.sarifStringifiedResults = stringifiedSarifData;
    throw error;
  }

  response += chalk.bold.green(summaryMessage);
  response += EOL + EOL;
  response += getProtectUpgradeWarningForPaths(
    packageJsonPathsWithSnykDepForProtect,
  );

  if (isIacShareResultsOptions(options)) {
    response += formatShareResultsOutput(iacOutputMeta!) + EOL.repeat(2);
    if (isReportCommand) {
      response += chalk.red.bold(
        'Warning:' +
          EOL +
          "We will be deprecating support for the 'snyk iac report' command by mid-June and 'snyk iac test --report' will become the default command for using our share results functionality.",
      );
    }
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}
