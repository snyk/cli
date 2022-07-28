import { Ora } from 'ora';
import { EOL } from 'os';
import { convertEngineToJsonResults } from './json';
import { SnykIacTestOutput } from './scan/results';

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
import { SnykIacTestError } from './errors';
import { convertEngineToSarifResults } from './sarif';
import { CustomError } from '../../../errors';

export function buildOutput({
  scanResult,
  testSpinner,
  projectName,
  orgSettings,
  options,
}: {
  scanResult: SnykIacTestOutput;
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
  scanResult: SnykIacTestOutput;
  projectName: string;
  orgSettings: IacOrgSettings;
  options: any;
}) {
  let responseData = '';

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

  if (options.json) {
    responseData = jsonData;
  } else if (options.sarif) {
    responseData = sarifData;
  } else {
    responseData = buildTextOutput({ scanResult, projectName, orgSettings });
  }

  const isFoundIssues = !!scanResult.results?.vulnerabilities?.length;
  if (isFoundIssues) {
    throw new FoundIssuesError({ responseData, jsonData, sarifData });
  }

  return { responseData, jsonData, sarifData };
}

const SEPARATOR = '\n-------------------------------------------------------\n';

function buildTextOutput({
  scanResult,
  projectName,
  orgSettings,
}: {
  scanResult: SnykIacTestOutput;
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
    const testFailures: IaCTestFailure[] = scanResult.errors.map((error) => {
      const formattedError = new SnykIacTestError(error);
      // If we received an error without a path it means that the scan failed
      if (!error?.fields?.path) {
        throw formattedError;
      }
      return {
        filePath: error.fields!.path!,
        failureReason: formattedError.userMessage,
      };
    });
    response += EOL.repeat(2) + formatIacTestFailures(testFailures);
  }

  response += EOL;
  response += SEPARATOR;
  response += EOL;
  response += formatIacTestSummary(testData);
  response += EOL;

  return response;
}

interface FoundIssuesErrorProps {
  responseData: string;
  jsonData: string;
  sarifData: string;
}

export class FoundIssuesError extends CustomError {
  public jsonStringifiedResults: string;
  public sarifStringifiedResults: string;

  constructor(props: FoundIssuesErrorProps) {
    super(props.responseData);
    this.code = 'VULNS' as any;
    this.strCode = 'VULNS';
    this.userMessage = props.responseData;
    this.jsonStringifiedResults = props.jsonData;
    this.sarifStringifiedResults = props.sarifData;
  }
}
