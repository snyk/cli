import * as Debug from 'debug';
import { EOL } from 'os';
import chalk from 'chalk';

import { MethodArgs } from '../../../args';
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
  iacTestTitle,
  shouldLogUserMessages,
  spinnerSuccessMessage,
  IaCTestFailure,
} from '../../../../lib/formatters/iac-output';
import { extractDataToSendFromResults } from '../../../../lib/formatters/test/format-test-results';

import { validateCredentials } from '../validate-credentials';
import { validateTestOptions } from '../validate-test-options';
import { setDefaultTestOptions } from '../set-default-test-options';
import { processCommandArgs } from '../../process-command-args';
import { displayResult } from '../../../../lib/formatters/test/display-result';

import { isIacShareResultsOptions } from './local-execution/assert-iac-options-flag';
import { hasFeatureFlag } from '../../../../lib/feature-flags';
import { buildDefaultOciRegistry } from './local-execution/rules/rules';
import { getIacOrgSettings } from './local-execution/measurable-methods';
import config from '../../../../lib/config';
import { UnsupportedEntitlementError } from '../../../../lib/errors/unsupported-entitlement-error';
import * as ora from 'ora';
import { CustomError, FormattedCustomError } from '../../../../lib/errors';
import { scan } from './scan';
import * as path from 'path';

const debug = Debug('snyk-test');
const SEPARATOR = '\n-------------------------------------------------------\n';

export default async function(...args: MethodArgs): Promise<TestCommandResult> {
  const { options: originalOptions, paths } = processCommandArgs(...args);

  const options = setDefaultTestOptions(originalOptions);
  validateTestOptions(options);
  validateCredentials(options);

  const orgPublicId = (options.org as string) ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);

  if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
    throw new UnsupportedEntitlementError('infrastructureAsCode');
  }

  const buildOciRegistry = () => buildDefaultOciRegistry(iacOrgSettings);

  let testSpinner: ora.Ora | undefined;

  const isNewIacOutputSupported =
    config.IAC_OUTPUT_V2 ||
    (await hasFeatureFlag('iacCliOutputRelease', options));

  if (shouldLogUserMessages(options, isNewIacOutputSupported)) {
    console.log(EOL + iacTestTitle + EOL);

    if (paths.some(isOutsideCurrentWorkingDirectory)) {
      printCurrentWorkingDirectoryTraversalWarning();
    }

    testSpinner = ora({ isSilent: options.quiet, stream: process.stdout });
  }

  if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
    throw new UnsupportedEntitlementError('infrastructureAsCode');
  }

  const {
    iacOutputMeta,
    iacScanFailures,
    iacIgnoredIssuesCount,
    results,
    resultOptions,
  } = await scan(
    iacOrgSettings,
    options,
    testSpinner,
    paths,
    orgPublicId,
    buildOciRegistry,
  );

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

    if (hasErrors) {
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

  if (isNewIacOutputSupported) {
    if (isPartialSuccess) {
      response += EOL + getIacDisplayedIssues(successResults, iacOutputMeta!);
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

    const iacTestSummary = `${formatIacTestSummary(
      {
        results: successResults,
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

  if (foundVulnerabilities) {
    response += chalk.bold.red(summaryMessage);
    response += EOL + EOL;

    if (isIacShareResultsOptions(options)) {
      response += formatShareResultsOutput(iacOutputMeta!) + EOL.repeat(2);
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

  if (isIacShareResultsOptions(options)) {
    response += formatShareResultsOutput(iacOutputMeta!) + EOL.repeat(2);
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    stringifiedJsonData,
    stringifiedSarifData,
  );
}

function isOutsideCurrentWorkingDirectory(p: string): boolean {
  return path.relative(process.cwd(), p).includes('..');
}

function printCurrentWorkingDirectoryTraversalWarning() {
  let msg = '';

  msg +=
    'Warning: Scanning paths outside the current working directory is deprecated and' +
    EOL;
  msg +=
    'will be removed in the future. Please see the documentation for further details:' +
    EOL +
    EOL;
  msg +=
    '  https://docs.snyk.io/products/snyk-infrastructure-as-code/snyk-cli-for-infrastructure-as-code/test-your-configuration-files' +
    EOL;

  console.log(chalk.yellow(msg));
}
