import { Ora } from 'ora';
import { EOL } from 'os';
import { SnykIacTestOutput } from '../../../../cli/commands/test/iac/v2/types';

import { TestCommandResult } from '../../../../cli/commands/types';
import {
  getIacDisplayedIssues,
  spinnerSuccessMessage,
} from '../../../formatters/iac-output';
import { formatSnykIacTestScanResultNewOutput } from '../../../formatters/iac-output/v2/issues-list/formatters';
import { IacTestOutput } from '../../../formatters/iac-output/v2/issues-list/types';

export function buildOutput({
  scanResult,
  testSpinner,
}: {
  scanResult: SnykIacTestOutput;
  testSpinner?: Ora;
}): TestCommandResult {
  testSpinner?.succeed(spinnerSuccessMessage);

  let response = '';
  const formattedScanResult: IacTestOutput = formatSnykIacTestScanResultNewOutput(
    scanResult.results,
  );
  response += EOL + getIacDisplayedIssues(formattedScanResult);

  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    '', // TODO: add JSON output
    '', // TODO: add SARIF output
  );
}
