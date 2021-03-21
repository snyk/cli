import { formatScanResults } from '../../../../src/cli/commands/test/iac-local-execution/results-formatter';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';
import {
  expectedFormattedResults,
  scanResults,
} from './results-formatter.fixtures';

describe('formatScanResults', () => {
  it('returns the formatted results as expected for output', () => {
    const formattedResults = formatScanResults(scanResults, {
      severityThreshold: SEVERITY.HIGH,
    });
    expect(formattedResults.length).toEqual(1);
    expect(formattedResults[0]).toEqual(expectedFormattedResults);
  });

  // TODO: add tests for the multi-doc yaml grouping
});
