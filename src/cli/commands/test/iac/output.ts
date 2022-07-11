import * as Debug from 'debug';
import { EOL } from 'os';
import chalk from 'chalk';

import { TestCommandResult } from '../../types';
import { LegacyVulnApiResult } from '../../../../lib/snyk-test/legacy';
import { mapIacTestResult } from '../../../../lib/snyk-test/iac-test-result';

import {
  summariseErrorResults,
  summariseVulnerableResults,
} from '../../../../lib/formatters';
import {
  failuresTipOutput,
  formatIacTestFailures,
  formatFailuresList,
  formatIacTestSummary,
  formatShareResultsOutput,
  getIacDisplayedIssues,
  getIacDisplayErrorFileOutput,
  spinnerSuccessMessage,
  IaCTestFailure,
  shouldLogUserMessages,
  iacTestTitle,
  shareResultsOutput,
} from '../../../../lib/formatters/iac-output';
import { extractDataToSendFromResults } from '../../../../lib/formatters/test/format-test-results';

import { displayResult } from '../../../../lib/formatters/test/display-result';

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
} from '../../../../lib/formatters/iac-output/v2';
import { formatTestData } from '../../../../lib/formatters/iac-output';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

export function buildSpinner({
  options,
  isNewIacOutputSupported,
}: {
  options: Options & TestOptions;
  isNewIacOutputSupported?: boolean;
}) {
  if (shouldLogUserMessages(options, isNewIacOutputSupported)) {
    return ora({ isSilent: options.quiet, stream: process.stdout });
  }
}

export function printHeader({
  options,
  isNewIacOutputSupported,
}: {
  options: Options & TestOptions;
  isNewIacOutputSupported?: boolean;
}) {
  if (shouldLogUserMessages(options, isNewIacOutputSupported)) {
    console.log(EOL + iacTestTitle + EOL);
  }
}

export function buildOutput({
  results,
  options,
  isNewIacOutputSupported,
  isIacShareCliResultsCustomRulesSupported,
  isIacCustomRulesEntitlementEnabled,
  iacOutputMeta,
  resultOptions,
  iacScanFailures,
  iacIgnoredIssuesCount,
  testSpinner,
}: {
  results: any[];
  options: Options & TestOptions;
  isNewIacOutputSupported: boolean;
  isIacShareCliResultsCustomRulesSupported: boolean;
  isIacCustomRulesEntitlementEnabled: boolean;
  iacOutputMeta?: IacOutputMeta;
  resultOptions: (Options & TestOptions)[];
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

  if (isNewIacOutputSupported) {
    if (isPartialSuccess) {
      response +=
        EOL + getIacDisplayedIssues(newOutputTestData.resultsBySeverity);
    }
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

  if (!isNewIacOutputSupported && hasErrors) {
    debug(`Failed to test ${errorResults.length} projects, errors:`);
    errorResults.forEach((err) => {
      const errString = err.stack ? err.stack.toString() : err.toString();
      debug('error: %s', errString);
    });
  }

  let summaryMessage = '';
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
      response += chalk.bold.red(summaryMessage);

      // take the code of the first problem to go through error
      // translation
      // HACK as there can be different errors, and we pass only the
      // first one
      const error: CustomError =
        isNewIacOutputSupported && allTestFailures
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

    response += isNewIacOutputSupported
      ? EOL.repeat(2) + formatIacTestFailures(allTestFailures)
      : iacScanFailures
          .map((reason) => chalk.bold.red(getIacDisplayErrorFileOutput(reason)))
          .join('');
  }

  if (isPartialSuccess && iacOutputMeta && isNewIacOutputSupported) {
    response += `${EOL}${SEPARATOR}${EOL}`;

    const iacTestSummary = `${formatIacTestSummary(newOutputTestData)}`;

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

  if (foundVulnerabilities) {
    response += chalk.bold.red(summaryMessage);
  } else {
    response += chalk.bold.green(summaryMessage);
  }

  response += EOL;

  if (isIacShareResultsOptions(options)) {
    if (isNewIacOutputSupported) {
      response += buildShareResultsSummary({
        options,
        iacOutputMeta,
        isIacCustomRulesEntitlementEnabled,
        isIacShareCliResultsCustomRulesSupported,
        isNewIacOutputSupported,
      });
    } else {
      response += EOL + shareResultsOutput(iacOutputMeta!);
    }
    response += EOL;
  }

  if (shouldPrintShareResultsTip(options, isNewIacOutputSupported)) {
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

function buildShareResultsSummary({
  iacOutputMeta,
  options,
  isIacCustomRulesEntitlementEnabled,
  isNewIacOutputSupported,
  isIacShareCliResultsCustomRulesSupported,
}: {
  iacOutputMeta?: IacOutputMeta;
  options: IaCTestFlags;
  isIacCustomRulesEntitlementEnabled: boolean;
  isNewIacOutputSupported: boolean;
  isIacShareCliResultsCustomRulesSupported: boolean;
}): string {
  let response = '';

  response += SEPARATOR + EOL + formatShareResultsOutput(iacOutputMeta!);

  if (
    shouldPrintShareCustomRulesDisclaimer(
      options,
      isIacCustomRulesEntitlementEnabled,
      isNewIacOutputSupported,
      isIacShareCliResultsCustomRulesSupported,
    )
  ) {
    response += EOL + EOL + shareCustomRulesDisclaimer;
  }

  return response;
}

function shouldPrintShareResultsTip(
  options: IaCTestFlags,
  isNewOutput: boolean,
): boolean {
  return shouldLogUserMessages(options, isNewOutput) && !options.report;
}

function shouldPrintShareCustomRulesDisclaimer(
  options: IaCTestFlags,
  isIacCustomRulesEntitlementEnabled: boolean,
  isNewOutput: boolean,
  isIacShareCliResultsCustomRulesSupported: boolean,
): boolean {
  return (
    shouldLogUserMessages(options, isNewOutput) &&
    Boolean(options.rules) &&
    isIacCustomRulesEntitlementEnabled &&
    !isIacShareCliResultsCustomRulesSupported
  );
}
