import {
  filterPoliciesBySeverity,
  formatScanResults,
} from '../../../../src/cli/commands/test/iac-local-execution/results-formatter';
import { SEVERITY } from '../../../../src/lib/snyk-test/common';
import {
  expectedFormattedResultsWithLineNumber,
  expectedFormattedResultsWithoutLineNumber,
  meta,
  policyStub,
  generateScanResults,
} from './results-formatter.fixtures';
import { issuesToLineNumbers } from '@snyk/cloud-config-parser';
import { PolicyMetadata } from '../../../../dist/cli/commands/test/iac-local-execution/types';

jest.mock('@snyk/cloud-config-parser');

describe('formatScanResults', () => {
  it.each([
    [
      { severityThreshold: SEVERITY.HIGH },
      expectedFormattedResultsWithoutLineNumber,
    ],
    [
      { severityThreshold: SEVERITY.HIGH, sarif: true },
      expectedFormattedResultsWithLineNumber,
    ],
    [
      { severityThreshold: SEVERITY.HIGH, json: true },
      expectedFormattedResultsWithLineNumber,
    ],
  ])(
    'given %p options object, returns the expected results',
    (optionsObject, expectedResult) => {
      (issuesToLineNumbers as jest.Mock).mockReturnValue(3);
      const formattedResults = formatScanResults(
        generateScanResults(),
        optionsObject,
        meta,
      );

      expect(formattedResults.length).toEqual(1);
      expect(formattedResults[0]).toEqual(expectedResult);
    },
  );
  // TODO: add tests for the multi-doc yaml grouping
});

describe('filterPoliciesBySeverity', () => {
  it('returns the formatted results filtered by severity - no default threshold', () => {
    const scanResults = generateScanResults();
    const results = filterPoliciesBySeverity(scanResults[0].violatedPolicies);

    expect(results).toEqual(scanResults[0].violatedPolicies);
  });

  it('returns the formatted results filtered by severity - medium threshold, equal to severity', () => {
    const scanResults = generateScanResults();
    const results = filterPoliciesBySeverity(
      scanResults[0].violatedPolicies,
      SEVERITY.MEDIUM,
    );

    expect(results).toEqual(scanResults[0].violatedPolicies);
  });

  it('returns no results if violatedPolicy severity is under threshold', () => {
    const scanResults = generateScanResults();
    const results: PolicyMetadata[] = filterPoliciesBySeverity(
      scanResults[0].violatedPolicies,
      SEVERITY.HIGH,
    );

    expect(results).toEqual([]);
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
