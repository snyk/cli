import * as Debug from 'debug';
import { EOL } from 'os';
const cloneDeep = require('lodash.clonedeep');
const assign = require('lodash.assign');
import chalk from 'chalk';
import { MissingArgError } from '../../../lib/errors';

import * as snyk from '../../../lib';
import { IacFileInDirectory, Options, TestOptions } from '../../../lib/types';
import { MethodArgs } from '../../args';
import { TestCommandResult } from '../../commands/types';
import { LegacyVulnApiResult, TestResult } from '../../../lib/snyk-test/legacy';
import { mapIacTestResult } from '../../../lib/snyk-test/iac-test-result';

import {
  summariseErrorResults,
  summariseVulnerableResults,
} from '../../../lib/formatters';
import * as utils from './utils';
import { getIacDisplayErrorFileOutput } from '../../../lib/formatters/iac-output';
import { getEcosystemForTest, testEcosystem } from '../../../lib/ecosystems';
import { hasFixes, hasPatches, hasUpgrades } from '../../../lib/vuln-helpers';
import { FailOn } from '../../../lib/snyk-test/common';
import {
  createErrorMappedResultsForJsonOutput,
  extractDataToSendFromResults,
} from '../../../lib/formatters/test/format-test-results';

import { test as iacTest } from './iac-test-shim';
import { validateCredentials } from './validate-credentials';
import { validateTestOptions } from './validate-test-options';
import { setDefaultTestOptions } from './set-default-test-options';
import { processCommandArgs } from '../process-command-args';
import { formatTestError } from './format-test-error';
import { displayResult } from '../../../lib/formatters/test/display-result';
import * as analytics from '../../../lib/analytics';

import {
  getPackageJsonPathsContainingSnykDependency,
  getProtectUpgradeWarningForPaths,
} from '../../../lib/protect-update-notification';
import {
  containsSpotlightVulnIds,
  notificationForSpotlightVulns,
} from '../../../lib/spotlight-vuln-notification';
import config from '../../../lib/config';
import { isIacShareResultsOptions } from './iac-local-execution/assert-iac-options-flag';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

// TODO: avoid using `as any` whenever it's possible

export default async function test(
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
        throw new Error(error);
      }
    }
  }

  const resultOptions: Array<Options & TestOptions> = [];
  const results = [] as any[];

  // Holds an array of scanned file metadata for output.
  let iacScanFailures: IacFileInDirectory[] | undefined;

  // Promise waterfall to test all other paths sequentially
  for (const path of paths) {
    // Create a copy of the options so a specific test can
    // modify them i.e. add `options.file` etc. We'll need
    // these options later.
    const testOpts = cloneDeep(options);
    testOpts.path = path;
    testOpts.projectName = testOpts['project-name'];

    let res: (TestResult | TestResult[]) | Error;
    try {
      if (options.iac) {
        // this path is an experimental feature feature for IaC which does issue scanning locally without sending files to our Backend servers.
        // once ready for GA, it is aimed to deprecate our remote-processing model, so IaC file scanning in the CLI is done locally.
        const { results, failures } = await iacTest(path, testOpts);
        testOpts.org = results[0]?.org;
        testOpts.projectName = results[0]?.projectName;
        res = results;
        iacScanFailures = failures;
      } else {
        res = await snyk.test(path, testOpts);
      }
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

  // resultOptions is now an array of 1 or more options used for
  // the tests results is now an array of 1 or more test results
  // values depend on `options.json` value - string or object
  const mappedResults = !options.iac
    ? createErrorMappedResultsForJsonOutput(results)
    : results.map(mapIacTestResult);

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
      if (options.failOn) {
        const fail = shouldFail(vulnerableResults, options.failOn);
        if (!fail) {
          // return here to prevent failure
          return TestCommandResult.createJsonTestCommandResult(
            stringifiedData,
            stringifiedJsonData,
            stringifiedSarifData,
          );
        }
      }
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

  let response = results
    .map((result, i) => {
      return displayResult(
        results[i] as LegacyVulnApiResult,
        resultOptions[i],
        result.foundProjectCount,
      );
    })
    .join(`\n${SEPARATOR}`);

  if (notSuccess) {
    debug(`Failed to test ${errorResults.length} projects, errors:`);
    errorResults.forEach((err) => {
      const errString = err.stack ? err.stack.toString() : err.toString();
      debug('error: %s', errString);
    });
  }

  let summaryMessage = '';
  let errorResultsLength = errorResults.length;

  if (options.iac && iacScanFailures) {
    errorResultsLength = iacScanFailures.length || errorResults.length;

    for (const reason of iacScanFailures) {
      response += chalk.bold.red(getIacDisplayErrorFileOutput(reason));
    }
  }

  if (results.length > 1) {
    const projects = results.length === 1 ? 'project' : 'projects';
    summaryMessage =
      `\n\n\nTested ${results.length} ${projects}` +
      summariseVulnerableResults(vulnerableResults, options) +
      summariseErrorResults(errorResultsLength) +
      '\n';
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
    if (options.failOn) {
      const fail = shouldFail(vulnerableResults, options.failOn);
      if (!fail) {
        // return here to prevent throwing failure
        response += chalk.bold.green(summaryMessage);
        response += EOL + EOL;
        response += getProtectUpgradeWarningForPaths(
          packageJsonPathsWithSnykDepForProtect,
        );

        return TestCommandResult.createHumanReadableTestCommandResult(
          response,
          stringifiedJsonData,
          stringifiedSarifData,
        );
      }
    }

    response += chalk.bold.red(summaryMessage);

    response += EOL + EOL;
    const foundSpotlightVulnIds = containsSpotlightVulnIds(results);
    const spotlightVulnsMsg = notificationForSpotlightVulns(
      foundSpotlightVulnIds,
    );
    response += spotlightVulnsMsg;

    if (isIacShareResultsOptions(options)) {
      response +=
        chalk.bold.white(
          `Your test results are available at: ${config.ROOT}/org/${resultOptions[0].org}/projects under the name ${resultOptions[0].projectName}`,
        ) + EOL;
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
    response +=
      chalk.bold.white(
        `Your test results are available at: ${config.ROOT}/org/${resultOptions[0].org}/projects under the name ${resultOptions[0].projectName}`,
      ) + EOL;
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}

function shouldFail(vulnerableResults: any[], failOn: FailOn) {
  // find reasons not to fail
  if (failOn === 'all') {
    return hasFixes(vulnerableResults);
  }
  if (failOn === 'upgradable') {
    return hasUpgrades(vulnerableResults);
  }
  if (failOn === 'patchable') {
    return hasPatches(vulnerableResults);
  }
  // should fail by default when there are vulnerable results
  return vulnerableResults.length > 0;
}
