import { EOL } from 'os';

import { TestCommandResult } from '../../types';
import { mapIacTestResult } from '../../../../lib/snyk-test/iac-test-result';

import {
  failuresTipOutput,
  formatIacTestFailures,
  formatFailuresList,
  formatIacTestSummary,
  formatShareResultsOutput,
  getIacDisplayedIssues,
  spinnerSuccessMessage,
  IaCTestFailure,
  shouldLogUserMessages,
  iacTestTitle,
} from '../../../../lib/formatters/iac-output/text';
import { extractDataToSendFromResults } from '../../../../lib/formatters/test/format-test-results';

import { isIacShareResultsOptions } from './local-execution/assert-iac-options-flag';
import * as ora from 'ora';
import { CustomError, FormattedCustomError } from '../../../../lib/errors';
import {
  IacFileInDirectory,
  IacOutputMeta,
  Options,
  TestOptions,
} from '../../../../lib/types';
import { IaCTestFlags } from './local-execution/types';
import {
  shareCustomRulesDisclaimer,
  shareResultsTip,
  formatTestData,
} from '../../../../lib/formatters/iac-output/text';
import { formatShareResultsOutputV2 } from '../../../../lib/formatters/iac-output/text/share-results';

const SEPARATOR = '\n-------------------------------------------------------\n';

export function buildSpinner(options: IaCTestFlags) {
  if (shouldLogUserMessages(options)) {
    return ora({ isSilent: options.quiet, stream: process.stdout });
  }
}

export function printHeader(options: IaCTestFlags) {
  if (shouldLogUserMessages(options)) {
    console.log(EOL + iacTestTitle + EOL);
  }
}

export function buildOutput({
  results,
  options,
  isIacShareCliResultsCustomRulesSupported,
  isIacCustomRulesEntitlementEnabled,
  iacOutputMeta,
  iacScanFailures,
  iacIgnoredIssuesCount,
  testSpinner,
}: {
  results: any[];
  options: Options & TestOptions;
  isIacShareCliResultsCustomRulesSupported: boolean;
  isIacCustomRulesEntitlementEnabled: boolean;
  iacOutputMeta: IacOutputMeta;
  iacScanFailures: IacFileInDirectory[];
  iacIgnoredIssuesCount: number;
  testSpinner?: ora.Ora;
}): TestCommandResult {
  // this is any[] to follow the resArray type above
  const successResults: any[] = [],
    errorResults: any[] = [];
  results.forEach((result) => {
    if (!(result instanceof Error)) {
      successResults.push(result);
    } else {
      errorResults.push(result);
    }
  });

  const vulnerableResults = successResults.filter(
    (res) =>
      (res.vulnerabilities && res.vulnerabilities.length) ||
      (res.result &&
        res.result.cloudConfigResults &&
        res.result.cloudConfigResults.length),
  );
  const hasErrors = errorResults.length;
  const isPartialSuccess = !hasErrors || successResults.length;
  const foundVulnerabilities = vulnerableResults.length;

  if (isPartialSuccess) {
    testSpinner?.succeed(spinnerSuccessMessage);
  } else {
    testSpinner?.stop();
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

    if (hasErrors && !options.sarif) {
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

  const newOutputTestData = formatTestData({
    oldFormattedResults: successResults,
    ignoresCount: iacIgnoredIssuesCount,
    iacOutputMeta: iacOutputMeta,
  });

  if (isPartialSuccess) {
    response +=
      EOL + getIacDisplayedIssues(newOutputTestData.resultsBySeverity);
  }

  let errorResultsLength = errorResults.length;

  if (iacScanFailures.length || hasErrors) {
    errorResultsLength = iacScanFailures.length || errorResults.length;

    const thrownErrors: IaCTestFailure[] = errorResults.map((err) => ({
      filePath: err.path,
      failureReason: err.message,
    }));

    const allTestFailures: IaCTestFailure[] = iacScanFailures
      .map((f) => ({
        filePath: f.filePath,
        failureReason: f.failureReason,
      }))
      .concat(thrownErrors);

    if (hasErrors && !isPartialSuccess) {
      // take the code of the first problem to go through error
      // translation
      // HACK as there can be different errors, and we pass only the
      // first one
      const error: CustomError = allTestFailures
        ? new FormattedCustomError(
            errorResults[0].message,
            formatFailuresList(allTestFailures),
          )
        : new CustomError(response);
      error.code = errorResults[0].code;
      error.userMessage = errorResults[0].userMessage;
      error.strCode = errorResults[0].strCode;

      throw error;
    }

    response += EOL.repeat(2) + formatIacTestFailures(allTestFailures);
  }

  if (isPartialSuccess && iacOutputMeta) {
    response += `${EOL}${SEPARATOR}${EOL}`;

    const iacTestSummary = `${formatIacTestSummary(newOutputTestData)}`;

    response += iacTestSummary;
  }

  if (results.length > 1) {
    response += errorResultsLength ? EOL.repeat(2) + failuresTipOutput : '';
  }

  response += EOL;

  if (isIacShareResultsOptions(options)) {
    response += buildShareResultsSummary({
      options,
      projectName: iacOutputMeta.projectName,
      orgName: iacOutputMeta.orgName,
      isIacCustomRulesEntitlementEnabled,
      isIacShareCliResultsCustomRulesSupported,
    });
    response += EOL;
  }

  if (shouldPrintShareResultsTip(options)) {
    response += SEPARATOR + EOL + shareResultsTip + EOL;
  }

  if (foundVulnerabilities) {
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

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}

export function buildShareResultsSummary({
  orgName,
  projectName,
  options,
  isIacCustomRulesEntitlementEnabled,
  isIacShareCliResultsCustomRulesSupported,
}: {
  orgName: string;
  projectName: string;
  options: IaCTestFlags;
  isIacCustomRulesEntitlementEnabled: boolean;
  isIacShareCliResultsCustomRulesSupported: boolean;
}): string {
  let response = '';

  response += SEPARATOR + EOL + formatShareResultsOutput(orgName, projectName);

  if (
    shouldPrintShareCustomRulesDisclaimer(
      options,
      isIacCustomRulesEntitlementEnabled,
      isIacShareCliResultsCustomRulesSupported,
    )
  ) {
    response += EOL + EOL + shareCustomRulesDisclaimer;
  }

  return response;
}

export function buildShareResultsSummaryV2({
  orgName,
  projectName,
  options,
  isIacCustomRulesEntitlementEnabled,
  isIacShareCliResultsCustomRulesSupported,
}: {
  orgName: string;
  projectName: string;
  options: IaCTestFlags;
  isIacCustomRulesEntitlementEnabled: boolean;
  isIacShareCliResultsCustomRulesSupported: boolean;
}): string {
  let response = '';

  response +=
    SEPARATOR + EOL + formatShareResultsOutputV2(orgName, projectName);

  if (
    shouldPrintShareCustomRulesDisclaimer(
      options,
      isIacCustomRulesEntitlementEnabled,
      isIacShareCliResultsCustomRulesSupported,
    )
  ) {
    response += EOL + EOL + shareCustomRulesDisclaimer;
  }

  return response;
}

export function shouldPrintShareResultsTip(options: IaCTestFlags): boolean {
  return shouldLogUserMessages(options) && !options.report;
}

function shouldPrintShareCustomRulesDisclaimer(
  options: IaCTestFlags,
  isIacCustomRulesEntitlementEnabled: boolean,
  isIacShareCliResultsCustomRulesSupported: boolean,
): boolean {
  return (
    shouldLogUserMessages(options) &&
    Boolean(options.rules) &&
    isIacCustomRulesEntitlementEnabled &&
    !isIacShareCliResultsCustomRulesSupported
  );
}
