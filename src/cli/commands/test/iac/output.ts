import * as Debug from 'debug';
import { EOL } from 'os';
import chalk from 'chalk';

import {
  IacFileInDirectory,
  IacOutputMeta,
  Options,
  TestOptions,
} from '../../../../lib/types';
import { TestCommandResult } from '../../../commands/types';
import { LegacyVulnApiResult } from '../../../../lib/snyk-test/legacy';
import { mapIacTestResult } from '../../../../lib/snyk-test/iac-test-result';

import {
  summariseErrorResults,
  summariseVulnerableResults,
} from '../../../../lib/formatters';
import {
  formatIacTestFailures,
  getIacDisplayErrorFileOutput,
} from '../../../../lib/formatters/iac-output';
import {
  hasFixes,
  hasPatches,
  hasUpgrades,
} from '../../../../lib/vuln-helpers';
import { FailOn } from '../../../../lib/snyk-test/common';
import { extractDataToSendFromResults } from '../../../../lib/formatters/test/format-test-results';

import { displayResult } from '../../../../lib/formatters/test/display-result';
import {
  containsSpotlightVulnIds,
  notificationForSpotlightVulns,
} from '../../../../lib/spotlight-vuln-notification';
import { isIacShareResultsOptions } from './local-execution/assert-iac-options-flag';
import {
  formatIacTestSummary,
  formatShareResultsOutput,
  getIacDisplayedIssues,
} from '../../../../lib/formatters/iac-output';
import { failuresTipOutput } from '../../../../lib/formatters/iac-output';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

export function buildOutput(
  options: any,
  results: any[],
  isNewIacOutputSupported: boolean | undefined,
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacIgnoredIssuesCount: number,
  iacOutputMeta: IacOutputMeta | undefined,
  resultOptions: (Options & TestOptions)[],
): TestCommandResult {
  if (options.json || options.sarif) {
    return buildJsonOrSarifOutput(options, results);
  }

  return buildTextOutput(
    options,
    results,
    isNewIacOutputSupported,
    iacScanFailures,
    iacIgnoredIssuesCount,
    iacOutputMeta,
    resultOptions,
  );
}

function buildJsonOrSarifOutput(options: any, results: any[]) {
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
  const mappedResults = results.map(mapIacTestResult);

  const {
    stdout: dataToSend,
    stringifiedData,
    stringifiedJsonData,
    stringifiedSarifData,
  } = extractDataToSendFromResults(results, mappedResults, options);

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

function buildTextOutput(
  options: any,
  results: any[],
  isNewIacOutputSupported: boolean | undefined,
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacIgnoredIssuesCount: number,
  iacOutputMeta: IacOutputMeta | undefined,
  resultOptions: (Options & TestOptions)[],
) {
  if (isNewIacOutputSupported) {
    return buildNewTextOutput(
      options,
      results,
      iacScanFailures,
      iacIgnoredIssuesCount,
      iacOutputMeta,
      resultOptions,
    );
  }
  return buildOldTextOutput(
    options,
    results,
    iacScanFailures,
    iacOutputMeta,
    resultOptions,
  );
}

function buildOldTextOutput(
  options: any,
  results: any[],
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacOutputMeta: IacOutputMeta | undefined,
  resultOptions: (Options & TestOptions)[],
) {
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
  const mappedResults = results.map(mapIacTestResult);

  const {
    stringifiedJsonData,
    stringifiedSarifData,
  } = extractDataToSendFromResults(results, mappedResults, options);

  let response = '';

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

    response += iacScanFailures
      .map((reason) => chalk.bold.red(getIacDisplayErrorFileOutput(reason)))
      .join('');
  }

  if (results.length > 1) {
    const projects = results.length === 1 ? 'project' : 'projects';
    summaryMessage +=
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
      response += formatShareResultsOutput(iacOutputMeta!) + EOL;
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

  if (isIacShareResultsOptions(options)) {
    response += formatShareResultsOutput(iacOutputMeta!) + EOL;
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}

function buildNewTextOutput(
  options: any,
  results: any[],
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacIgnoredIssuesCount: number,
  iacOutputMeta: IacOutputMeta | undefined,
  resultOptions: (Options & TestOptions)[],
) {
  const errorResults = results.filter((res) => res instanceof Error);
  const notSuccess = errorResults.length > 0;

  if (notSuccess) {
    buildNewTextOutputForFailureAndThrow(
      results,
      iacScanFailures,
      resultOptions,
    );
  }

  return buildNewTextOutputForSuccess(
    options,
    results,
    iacScanFailures,
    iacIgnoredIssuesCount,
    iacOutputMeta,
  );
}

function buildNewTextOutputForSuccess(
  options: any,
  results: any[],
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacIgnoredIssuesCount: number,
  iacOutputMeta: IacOutputMeta | undefined,
) {
  const vulnerableResults = results.filter(
    (res) =>
      (res.vulnerabilities && res.vulnerabilities.length) ||
      (res.result &&
        res.result.cloudConfigResults &&
        res.result.cloudConfigResults.length),
  );
  const errorResults = results.filter((res) => res instanceof Error);
  const foundVulnerabilities = vulnerableResults.length > 0;

  // resultOptions is now an array of 1 or more options used for
  // the tests results is now an array of 1 or more test results
  // values depend on `options.json` value - string or object
  const mappedResults = results.map(mapIacTestResult);

  const {
    stringifiedJsonData,
    stringifiedSarifData,
  } = extractDataToSendFromResults(results, mappedResults, options);

  let response = '';

  response += getIacDisplayedIssues(results, iacOutputMeta!);

  let errorResultsLength = errorResults.length;

  if (iacScanFailures?.length) {
    errorResultsLength = iacScanFailures.length || errorResults.length;

    response += EOL + formatIacTestFailures(iacScanFailures);
  }

  if (iacOutputMeta) {
    response += `${EOL}${SEPARATOR}${EOL}`;

    const iacTestSummary = `${formatIacTestSummary(
      {
        results,
        ignoreCount: iacIgnoredIssuesCount,
      },
      iacOutputMeta,
    )}`;

    response += iacTestSummary;
  }

  if (results.length > 1) {
    response += errorResultsLength ? EOL.repeat(2) + failuresTipOutput : '';
  }

  if (foundVulnerabilities) {
    if (options.failOn) {
      const fail = shouldFail(vulnerableResults, options.failOn);
      if (!fail) {
        // return here to prevent throwing failure
        return TestCommandResult.createHumanReadableTestCommandResult(
          response,
          stringifiedJsonData,
          stringifiedSarifData,
        );
      }
    }

    const foundSpotlightVulnIds = containsSpotlightVulnIds(results);
    const spotlightVulnsMsg = notificationForSpotlightVulns(
      foundSpotlightVulnIds,
    );
    response += spotlightVulnsMsg;

    if (isIacShareResultsOptions(options)) {
      response += formatShareResultsOutput(iacOutputMeta!) + EOL;
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

  if (isIacShareResultsOptions(options)) {
    response += formatShareResultsOutput(iacOutputMeta!) + EOL;
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}

function buildNewTextOutputForFailureAndThrow(
  results: any[],
  iacScanFailures: IacFileInDirectory[] | undefined,
  resultOptions: (Options & TestOptions)[],
) {
  const errorResults = results.filter((res) => res instanceof Error);

  let response = '';

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

  debug(`Failed to test ${errorResults.length} projects, errors:`);
  errorResults.forEach((err) => {
    const errString = err.stack ? err.stack.toString() : err.toString();
    debug('error: %s', errString);
  });

  let errorResultsLength = errorResults.length;

  if (iacScanFailures?.length) {
    errorResultsLength = iacScanFailures.length || errorResults.length;

    response += EOL + formatIacTestFailures(iacScanFailures);
  }

  if (results.length > 1) {
    response += errorResultsLength ? EOL.repeat(2) + failuresTipOutput : '';
  }

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
