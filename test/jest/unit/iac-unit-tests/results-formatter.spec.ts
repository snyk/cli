import { formatScanResults } from '../../../../src/cli/commands/test/iac-local-execution/results-formatter';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';
import {
  expectedFormattedResults,
  scanResults,
} from './results-formatter.fixtures';
import { issuesToLineNumbers } from '@snyk/cloud-config-parser';

jest.mock('@snyk/cloud-config-parser');

describe('formatScanResults', () => {
  it('returns the formatted results as expected for output', () => {
    (issuesToLineNumbers as jest.Mock).mockReturnValue(3);
    const formattedResults = formatScanResults(scanResults, {
      severityThreshold: SEVERITY.HIGH,
    });
    expect(formattedResults.length).toEqual(1);
    expect(formattedResults[0]).toEqual(expectedFormattedResults);
  });

  // TODO: add tests for the multi-doc yaml grouping
});
