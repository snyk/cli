import { Ora } from 'ora';
import { EOL } from 'os';
import { convertEngineToJsonResults } from './json';
import { TestOutput } from './scan/results';

import { TestCommandResult } from '../../../../cli/commands/types';
import {
  formatIacTestFailures,
  formatIacTestSummary,
  getIacDisplayedIssues,
  IaCTestFailure,
  spinnerSuccessMessage,
  formatSnykIacTestTestData,
  shareResultsTip,
} from '../../../formatters/iac-output/text';
import { jsonStringifyLargeObject } from '../../../json';
import {
  IaCErrorCodes,
  IacOrgSettings,
  IaCTestFlags,
} from '../../../../cli/commands/test/iac/local-execution/types';
import { convertEngineToSarifResults } from './sarif';
import { CustomError, FormattedCustomError } from '../../../errors';
import { SnykIacTestError } from './errors';
import stripAnsi from 'strip-ansi';
import * as path from 'path';
import { getErrorStringCode } from '../../../../cli/commands/test/iac/local-execution/error-utils';
import {
  buildShareResultsSummary,
  shouldPrintShareResultsTip,
} from '../../../../cli/commands/test/iac/output';

export function buildOutput({
  scanResult,
  testSpinner,
  orgSettings,
  options,
}: {
  scanResult: TestOutput;
  testSpinner?: Ora;
  orgSettings: IacOrgSettings;
  options: any;
}): TestCommandResult {
  if (scanResult.results) {
    testSpinner?.succeed(spinnerSuccessMessage);
  } else {
    testSpinner?.stop();
  }

  const { responseData, jsonData, sarifData } = buildTestCommandResultData({
    scanResult,
    orgSettings,
    options,
  });

  if (options.json || options.sarif) {
    return TestCommandResult.createJsonTestCommandResult(
      responseData,
      jsonData,
      sarifData,
    );
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    responseData,
    jsonData,
    sarifData,
  );
}

function buildTestCommandResultData({
  scanResult,
  orgSettings,
  options,
}: {
  scanResult: TestOutput;
  orgSettings: IacOrgSettings;
  options: any;
}) {
  const projectName =
    scanResult.results?.metadata?.projectName ?? path.basename(process.cwd());

  const jsonData = jsonStringifyLargeObject(
    convertEngineToJsonResults({
      results: scanResult,
      projectName,
      orgSettings,
    }),
  );

  const sarifData = jsonStringifyLargeObject(
    convertEngineToSarifResults(scanResult),
  );

  assertHasSuccessfulScans(
    scanResult,
    { json: jsonData, sarif: sarifData },
    options,
  );

  let responseData: string;
  if (options.json) {
    responseData = jsonData;
  } else if (options.sarif) {
    responseData = sarifData;
  } else {
    responseData = buildTextOutput({
      scanResult,
      projectName,
      orgSettings,
      options,
    });
  }

  const hasVulnerabilities = !!scanResult.results?.vulnerabilities?.length;
  if (hasVulnerabilities) {
    throw new FoundIssuesError({
      response: responseData,
      json: jsonData,
      sarif: sarifData,
    });
  }

  return { responseData, jsonData, sarifData };
}

const SEPARATOR = '\n-------------------------------------------------------\n';

function buildTextOutput({
  scanResult,
  projectName,
  orgSettings,
  options,
}: {
  scanResult: TestOutput;
  projectName: string;
  orgSettings: IacOrgSettings;
  options: IaCTestFlags;
}): string {
  let response = '';

  const testData = formatSnykIacTestTestData(
    scanResult.results,
    projectName,
    orgSettings.meta.org,
  );

  response +=
    EOL +
    getIacDisplayedIssues(testData.resultsBySeverity, {
      shouldShowLineNumbers: true,
    });

  if (scanResult.errors) {
    const testFailures: IaCTestFailure[] = scanResult.errors.map((error) => ({
      filePath: error.fields.path,
      failureReason: error.userMessage,
    }));

    response += EOL.repeat(2) + formatIacTestFailures(testFailures);
  }

  response += EOL;
  response += SEPARATOR;
  response += EOL;
  response += formatIacTestSummary(testData);
  response += EOL;

  if (options.report) {
    response += buildShareResultsSummary({
      orgName: orgSettings.meta.org,
      projectName,
      options,
      isIacCustomRulesEntitlementEnabled: false, // TODO: update when we add custom rules support
      isIacShareCliResultsCustomRulesSupported: false, // TODO: update when we add custom rules support
    });
    response += EOL;
  }

  if (shouldPrintShareResultsTip(options)) {
    response += SEPARATOR + EOL + shareResultsTip + EOL;
  }

  return response;
}

function assertHasSuccessfulScans(
  scanResult: TestOutput,
  responseData: Omit<ResponseData, 'response'>,
  options: { json?: boolean; sarif?: boolean },
): void {
  const hasResources = !!scanResult.results?.resources?.length;
  const hasErrors = !!scanResult.errors?.length;
  const hasSuccessfulScans = hasResources || !hasErrors;

  if (!hasSuccessfulScans) {
    const hasLoadableInput = scanResult.errors!.some(
      (error) => error.code !== IaCErrorCodes.NoLoadableInput,
    );

    throw hasLoadableInput
      ? new NoSuccessfulScansError(responseData, scanResult.errors!, options)
      : new NoLoadableInputError(responseData, scanResult.errors!, options);
  }
}

interface ResponseData {
  response: string;
  json: string;
  sarif: string;
}

export class NoSuccessfulScansError extends FormattedCustomError {
  public json: string | undefined;
  public jsonStringifiedResults: string | undefined;
  public sarifStringifiedResults: string | undefined;
  public fields: { path: string } & Record<string, string>;

  constructor(
    responseData: Omit<ResponseData, 'response'>,
    errors: SnykIacTestError[],
    options: { json?: boolean; sarif?: boolean },
  ) {
    const firstErr = errors[0];
    const isText = !options.json && !options.sarif;
    const message = options.json
      ? responseData.json
      : options.sarif
      ? responseData.sarif
      : firstErr.message;
    super(
      message,
      isText
        ? formatIacTestFailures(
            errors.map((scanError) => ({
              failureReason: scanError.userMessage,
              filePath: scanError.fields.path,
            })),
          )
        : stripAnsi(message),
    );

    this.code = firstErr.code;
    this.strCode = firstErr.strCode;
    this.json = isText ? responseData.json : message;
    this.jsonStringifiedResults = responseData.json;
    this.sarifStringifiedResults = responseData.sarif;
    this.fields = firstErr.fields;
  }

  public get path(): string {
    return this.fields?.path;
  }

  public set path(path1: string) {
    this.fields.path = path1;
  }
}

export class NoLoadableInputError extends NoSuccessfulScansError {
  constructor(
    responseData: Omit<ResponseData, 'response'>,
    errors: SnykIacTestError[],
    options: { json?: boolean; sarif?: boolean },
  ) {
    super(responseData, errors, options);

    (this.code = IaCErrorCodes.NoFilesToScanError),
      (this.strCode = getErrorStringCode(this.code));
  }
}

export class FoundIssuesError extends CustomError {
  public jsonStringifiedResults: string;
  public sarifStringifiedResults: string;

  constructor(responseData: ResponseData) {
    super(responseData.response);
    this.code = 'VULNS' as any;
    this.strCode = 'VULNS';
    this.userMessage = responseData.response;
    this.jsonStringifiedResults = responseData.json;
    this.sarifStringifiedResults = responseData.sarif;
  }
}
