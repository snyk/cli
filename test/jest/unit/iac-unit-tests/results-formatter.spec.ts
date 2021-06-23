import {
  filterPoliciesBySeverity,
  formatScanResults,
} from '../../../../src/cli/commands/test/iac-local-execution/results-formatter';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';
import {
  expectedFormattedResults,
  meta,
  policyStub,
  scanResults,
} from './results-formatter.fixtures';
import { issuesToLineNumbers } from '@snyk/cloud-config-parser';
import { PolicyMetadata } from '../../../../dist/cli/commands/test/iac-local-execution/types';

jest.mock('@snyk/cloud-config-parser');

describe('formatScanResults', () => {
  it('returns the formatted results as expected for output', () => {
    (issuesToLineNumbers as jest.Mock).mockReturnValue(3);
    const formattedResults = formatScanResults(
      scanResults,
      { severityThreshold: SEVERITY.HIGH },
      meta,
    );
    expect(formattedResults.length).toEqual(1);
    expect(formattedResults[0]).toEqual(expectedFormattedResults);
  });

  // TODO: add tests for the multi-doc yaml grouping
});

describe('filterPoliciesBySeverity', () => {
  it('returns the formatted results filtered by severity - no default threshold', () => {
    const results = filterPoliciesBySeverity(scanResults[0].violatedPolicies);

    expect(results).toEqual(scanResults[0].violatedPolicies);
  });

  it('returns the formatted results filtered by severity - medium threshold, equal to severity', () => {
    const results = filterPoliciesBySeverity(
      scanResults[0].violatedPolicies,
      SEVERITY.MEDIUM,
    );

    expect(results).toEqual(scanResults[0].violatedPolicies);
  });

  it('returns no results if violatedPolicy severity is under threshold', () => {
    const results: PolicyMetadata[] = filterPoliciesBySeverity(
      scanResults[0].violatedPolicies,
      SEVERITY.HIGH,
    );

    expect(results).toEqual(scanResults[1].violatedPolicies);
  });

  it('returns no results if violatedPolicy severity is now set to none', () => {
    const resultsWithSeverityOfNone = {
      ...policyStub,
      severity: 'none' as SEVERITY,
    };
    const results: PolicyMetadata[] = filterPoliciesBySeverity([
      resultsWithSeverityOfNone,
    ]);

    expect(results).toEqual([]);
  });
});
