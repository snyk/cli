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
} from '../../../formatters/iac-output';
import { formatSnykIacTestTestData } from '../../../formatters/iac-output';
import { jsonStringifyLargeObject } from '../../../json';
import { IacOrgSettings } from '../../../../cli/commands/test/iac/local-execution/types';
import { convertEngineToSarifResults } from './sarif';
import { CustomError, FormattedCustomError } from '../../../errors';
import { SnykIacTestError } from './errors';
import stripAnsi from 'strip-ansi';

export function buildOutput({
  scanResult,
  testSpinner,
  projectName,
  orgSettings,
  options,
}: {
  scanResult: TestOutput;
  testSpinner?: Ora;
  projectName: string;
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
    projectName,
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
  projectName,
  orgSettings,
  options,
}: {
  scanResult: TestOutput;
  projectName: string;
  orgSettings: IacOrgSettings;
  options: any;
}) {
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

  const isPartialSuccess =
    scanResult.results?.resources?.length || !scanResult.errors?.length;
  if (!isPartialSuccess) {
    throw new NoSuccessfulScansError(
      { json: jsonData, sarif: sarifData },
      scanResult.errors!,
      options,
    );
  }

  let responseData: string;
  if (options.json) {
    responseData = jsonData;
  } else if (options.sarif) {
    responseData = sarifData;
  } else {
    responseData = buildTextOutput({ scanResult, projectName, orgSettings });
  }

  const isFoundIssues = !!scanResult.results?.vulnerabilities?.length;
  if (isFoundIssues) {
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
}: {
  scanResult: TestOutput;
  projectName: string;
  orgSettings: IacOrgSettings;
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

  return response;
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
    this.strCode = firstErr.strCode;
    this.code = firstErr.code;
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
