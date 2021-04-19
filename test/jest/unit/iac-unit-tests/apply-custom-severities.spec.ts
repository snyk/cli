import * as getIacOrgSettingsModule from '../../../../src/cli/commands/test/iac-local-execution/org-settings/get-iac-org-settings';
import { applyCustomSeverities } from '../../../../src/cli/commands/test/iac-local-execution/org-settings/apply-custom-severities';
import { scanResults } from './results-formatter.fixtures';

describe('applyCustomSeverities', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const mockedIacSettings = {
    meta: {
      isPrivate: false,
      isLicensesEnabled: false,
      ignoreSettings: null,
      org: 'org-name',
    },
    customPolicies: {
      'SNYK-CC-TF-1': { severity: 'high' },
      'SNYK-CC-K8S-1': { severity: 'low' },
    },
  };

  it('updates existing severity with custom one for the same public id', async () => {
    jest
      .spyOn(getIacOrgSettingsModule, 'getIacOrgSettings')
      .mockResolvedValue(mockedIacSettings);

    const actualResults = await applyCustomSeverities(scanResults);
    const actualSeverity = actualResults[0].violatedPolicies[0].severity;

    expect(actualSeverity).toEqual(
      mockedIacSettings.customPolicies['SNYK-CC-K8S-1'].severity,
    );
  });

  it('does not update existing severity when there is no match for that public id', async () => {
    const notMatchingCustomPolicies = {
      ...mockedIacSettings,
      customPolicies: { 'SNYK-CC-K8S-1039': { severity: 'high' } },
    };
    jest
      .spyOn(getIacOrgSettingsModule, 'getIacOrgSettings')
      .mockResolvedValue(notMatchingCustomPolicies);

    const actualResults = await applyCustomSeverities(scanResults);

    expect(actualResults).toEqual(scanResults);
  });
});
