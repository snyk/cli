import { applyCustomSeverities } from '../../../../src/cli/commands/test/iac/local-execution/org-settings/apply-custom-severities';
import { generateScanResults } from './results-formatter.fixtures';

describe('applyCustomSeverities', () => {
  const mockedCustomPolicies = {
    'SNYK-CC-TF-1': { severity: 'high' },
    'SNYK-CC-K8S-1': { severity: 'low' },
  };

  it('updates existing severity with custom one for the same public id', async () => {
    const scanResults = generateScanResults();
    const actualResults = await applyCustomSeverities(
      scanResults,
      mockedCustomPolicies,
    );
    const actualSeverity = actualResults[0].violatedPolicies[0].severity;

    expect(actualSeverity).toEqual(
      mockedCustomPolicies['SNYK-CC-K8S-1'].severity,
    );
  });

  it('does not update existing severity when there is no match for that public id', async () => {
    const notMatchingCustomPolicies = {
      'SNYK-CC-K8S-1039': { severity: 'high' },
    };
    const scanResults = generateScanResults();
    const actualResults = await applyCustomSeverities(
      scanResults,
      notMatchingCustomPolicies,
    );

    expect(actualResults).toEqual(scanResults);
  });
});
