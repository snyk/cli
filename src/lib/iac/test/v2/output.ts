import { Ora } from 'ora';
import { EOL } from 'os';
import { convertEngineToJsonResults } from './json';
import { SnykIacTestOutput } from './scan/results';

import { TestCommandResult } from '../../../../cli/commands/types';
import {
  getIacDisplayedIssues,
  spinnerSuccessMessage,
} from '../../../formatters/iac-output';
import { formatSnykIacTestTestData } from '../../../formatters/iac-output';
import { jsonStringifyLargeObject } from '../../../json';
import { IacOrgSettings } from '../../../../cli/commands/test/iac/local-execution/types';

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
  testSpinner?.succeed(spinnerSuccessMessage);

  let response = '';
  const testData = formatSnykIacTestTestData(scanResult.results);
  response += EOL + getIacDisplayedIssues(testData.resultsBySeverity);

  const jsonData = jsonStringifyLargeObject(
    convertEngineToJsonResults({
      results: scanResult,
      projectName,
      orgSettings,
    }),
  );

  if (options.json) {
    return TestCommandResult.createJsonTestCommandResult(
      jsonData,
      jsonData,
      '',
    );
  }

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    jsonData,
    '',
  );
}
