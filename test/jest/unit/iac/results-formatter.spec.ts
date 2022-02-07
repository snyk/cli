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
  expectedFormattedResultsGeneratedByCustomRules,
} from './results-formatter.fixtures';
import * as cloudConfigParserModule from '@snyk/cloud-config-parser';
import {
  EngineType,
  PolicyMetadata,
} from '../../../../src/cli/commands/test/iac-local-execution/types';

jest.mock('@snyk/cloud-config-parser', () => ({
  ...jest.requireActual('@snyk/cloud-config-parser'),
}));
const validTree = { '0': { nodes: [] } };
describe('formatScanResults', () => {
  it.each([
    [
      {
        formatOptions: { severityThreshold: SEVERITY.HIGH },
        generateOptions: {},
      },
      expectedFormattedResultsWithLineNumber,
    ],
    [
      {
        formatOptions: { severityThreshold: SEVERITY.HIGH, sarif: true },
        generateOptions: {},
      },
      expectedFormattedResultsWithLineNumber,
    ],
    [
      {
        formatOptions: { severityThreshold: SEVERITY.HIGH, json: true },
        generateOptions: {},
      },
      expectedFormattedResultsWithLineNumber,
    ],
    [
      {
        formatOptions: {
          severityThreshold: SEVERITY.HIGH,
          'sarif-file-output': 'output.sarif',
        },
        generateOptions: {},
      },
      expectedFormattedResultsWithLineNumber,
    ],
    [
      {
        formatOptions: {
          severityThreshold: SEVERITY.HIGH,
          'json-file-output': 'output.json',
        },
        generateOptions: {},
      },
      expectedFormattedResultsWithLineNumber,
    ],
    [
      {
        formatOptions: { severityThreshold: SEVERITY.HIGH },
        generateOptions: { engineType: EngineType.Custom },
      },
      expectedFormattedResultsGeneratedByCustomRules,
    ],
  ])(
    'given %p options object, returns the expected results',
    (optionsObject, expectedResult) => {
      jest
        .spyOn(cloudConfigParserModule, 'getTrees')
        .mockReturnValue(validTree);
      jest.spyOn(cloudConfigParserModule, 'getLineNumber').mockReturnValue(3);
      const formattedResults = formatScanResults(
        generateScanResults(optionsObject.generateOptions),
        optionsObject.formatOptions,
        meta,
        {},
      );

      expect(formattedResults.length).toEqual(1);
      expect(formattedResults[0]).toEqual(expectedResult);
    },
  );
});

describe('parser failures should return -1 for lineNumber', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
  });

  it('creates a valid tree, but the getLineNumber() fails', () => {
    jest.spyOn(cloudConfigParserModule, 'getTrees').mockReturnValue(validTree);
    jest
      .spyOn(cloudConfigParserModule, 'getLineNumber')
      .mockImplementation(() => {
        throw new Error();
      });
    const formattedResults = formatScanResults(
      generateScanResults(),
      { severityThreshold: SEVERITY.HIGH },
      meta,
      {},
    );

    expect(formattedResults.length).toEqual(1);
    expect(formattedResults[0]).toEqual(
      expectedFormattedResultsWithoutLineNumber,
    );
  });

  it('sends an invalid tree and getLineNumber() fails', () => {
    jest
      .spyOn(cloudConfigParserModule, 'getTrees')
      .mockReturnValue(null as any);
    const formattedResults = formatScanResults(
      generateScanResults(),
      { severityThreshold: SEVERITY.HIGH },
      meta,
      {},
    );

    expect(formattedResults.length).toEqual(1);
    expect(formattedResults[0]).toEqual(
      expectedFormattedResultsWithoutLineNumber,
    );
  });
});

// TODO: add tests for the multi-doc yaml grouping
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
