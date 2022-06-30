import { Ora } from 'ora';
import { EOL } from 'os';
import { convertEngineToJsonResults } from './json';
import { SnykIacTestOutput } from './scan/results';

import { TestCommandResult } from '../../../../cli/commands/types';
import {
  getIacDisplayedIssues,
  spinnerSuccessMessage,
} from '../../../formatters/iac-output';
import { formatSnykIacTestScanResultNewOutput } from '../../../formatters/iac-output/v2/issues-list/formatters';
import { IacTestOutput } from '../../../formatters/iac-output/v2/issues-list/types';
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
  const formattedScanResult: IacTestOutput = formatSnykIacTestScanResultNewOutput(
    scanResult.results,
  );
  response += EOL + getIacDisplayedIssues(formattedScanResult);

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
