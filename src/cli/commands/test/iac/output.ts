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
  initalUserMessageOutput,
  shouldPrintIacInitialMessage,
} from '../../../../lib/formatters/iac-output';
import { extractDataToSendFromResults } from '../../../../lib/formatters/test/format-test-results';

import { displayResult } from '../../../../lib/formatters/test/display-result';
import { isIacShareResultsOptions } from './local-execution/assert-iac-options-flag';
import {
  formatIacTestSummary,
  formatShareResultsOutput,
  getIacDisplayedIssues,
} from '../../../../lib/formatters/iac-output';
import { failuresTipOutput } from '../../../../lib/formatters/iac-output';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

export function printInitialMessage(
  options: any,
  isNewIacOutputSupported: boolean | undefined,
) {
  if (shouldPrintIacInitialMessage(options, isNewIacOutputSupported)) {
    console.log(EOL + initalUserMessageOutput);
  }
}

export function buildOutput(
  options: any,
  results: any[],
  isReportCommand: boolean,
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
    isReportCommand,
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
      res.result &&
      res.result.cloudConfigResults &&
      res.result.cloudConfigResults.length,
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
  isReportCommand: boolean,
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
      isReportCommand,
      iacScanFailures,
      iacIgnoredIssuesCount,
      iacOutputMeta,
      resultOptions,
    );
  }
  return buildOldTextOutput(
    options,
    results,
    isReportCommand,
    iacScanFailures,
    iacOutputMeta,
    resultOptions,
  );
}

function buildOldTextOutput(
  options: any,
  results: any[],
  isReportCommand: boolean,
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacOutputMeta: IacOutputMeta | undefined,
  resultOptions: (Options & TestOptions)[],
) {
  const vulnerableResults = results.filter(
    (res) =>
      res.result &&
      res.result.cloudConfigResults &&
      res.result.cloudConfigResults.length,
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

  if (foundVulnerabilities || notSuccess) {
    response += chalk.bold.red(summaryMessage);
  } else {
    response += chalk.bold.green(summaryMessage);
  }

  if (notSuccess) {
    throw new GenericError(response, errorResults);
  }

  response += EOL + EOL;

  if (isIacShareResultsOptions(options)) {
    response += formatShareResultsOutput(iacOutputMeta!) + EOL + EOL;

    if (isReportCommand) {
      response += buildReportCommandWarning();
    }
  }

  if (foundVulnerabilities) {
    throw new VulnerabilitiesFoundError(
      response,
      vulnerableResults,
      stringifiedJsonData,
      stringifiedSarifData,
    );
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
  isReportCommand: boolean,
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacIgnoredIssuesCount: number,
  iacOutputMeta: IacOutputMeta | undefined,
  resultOptions: (Options & TestOptions)[],
) {
  if (containsErrors(results)) {
    buildNewTextOutputForErrorAndThrow(results, iacScanFailures, resultOptions);
  }

  return buildNewTextOutputForSuccessOrFailure(
    options,
    results,
    isReportCommand,
    iacScanFailures,
    iacIgnoredIssuesCount,
    iacOutputMeta,
  );
}

function buildNewTextOutputForSuccessOrFailure(
  options: any,
  results: any[],
  isReportCommand: boolean,
  iacScanFailures: IacFileInDirectory[] | undefined,
  iacIgnoredIssuesCount: number,
  iacOutputMeta: IacOutputMeta | undefined,
) {
  const vulnerableResults = results.filter(
    (res) =>
      res.result &&
      res.result.cloudConfigResults &&
      res.result.cloudConfigResults.length,
  );
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

  let errorResultsLength = 0;

  if (iacScanFailures?.length) {
    errorResultsLength = iacScanFailures.length || 0;

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

  if (isIacShareResultsOptions(options)) {
    response += formatShareResultsOutput(iacOutputMeta!) + EOL;

    if (isReportCommand) {
      response += buildReportCommandWarning();
    }
  }

  if (foundVulnerabilities) {
    throw new VulnerabilitiesFoundError(
      response,
      vulnerableResults,
      stringifiedJsonData,
      stringifiedSarifData,
    );
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}

function buildNewTextOutputForErrorAndThrow(
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

  throw new GenericError(response, errorResults);
}

function containsErrors(results: any[]) {
  return results.some((res) => res instanceof Error);
}

function buildReportCommandWarning() {
  return chalk.red.bold(
    'Warning:' +
      EOL +
      "We will be deprecating support for the 'snyk iac report' command by mid-June and 'snyk iac test --report' will become the default command for using our share results functionality.",
  );
}

class GenericError extends Error {
  code: any;
  userMessage: any;
  strCode: any;

  constructor(response: string, errorResults: any[]) {
    super(response);

    this.code = errorResults[0].code;
    this.userMessage = errorResults[0].userMessage;
    this.strCode = errorResults[0].strCode;
  }
}

class VulnerabilitiesFoundError extends Error {
  code: any;
  userMessage: any;
  jsonStringifiedResults: string;
  sarifStringifiedResults: string;

  constructor(
    response: string,
    vulnerableResults: any[],
    jsonData: string,
    sarifData: string,
  ) {
    super(response);

    this.code = vulnerableResults[0].code || 'VULNS';
    this.userMessage = vulnerableResults[0].userMessage;
    this.jsonStringifiedResults = jsonData;
    this.sarifStringifiedResults = sarifData;
  }
}
