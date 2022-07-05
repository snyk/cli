import * as fs from 'fs';
import * as path from 'path';
import { IacOrgSettings } from '../../../../../../../src/cli/commands/test/iac/local-execution/types';
import {
  convertEngineToJsonResults,
  Result,
} from '../../../../../../../src/lib/iac/test/v2/json';
import { SnykIacTestOutput } from '../../../../../../../src/lib/iac/test/v2/scan/results';

describe('convertEngineToJsonResults', () => {
  const snykIacTestFixtureContent = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'iac',
      'process-results',
      'fixtures',
      'snyk-iac-test-results.json',
    ),
    'utf-8',
  );
  const snykIacTestFixture: SnykIacTestOutput = JSON.parse(
    snykIacTestFixtureContent,
  );

  const experimentalJsonOutputFixtureContent = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'iac',
      'process-results',
      'fixtures',
      'experimental-json-output.json',
    ),
    'utf-8',
  );
  let experimentalJsonOutputFixture: Result[] = JSON.parse(
    experimentalJsonOutputFixtureContent,
  );

  experimentalJsonOutputFixture = experimentalJsonOutputFixture.map((item) => {
    return { ...item, path: process.cwd() };
  });

  const orgSettings: IacOrgSettings = {
    meta: {
      isPrivate: false,
      isLicensesEnabled: false,
      ignoreSettings: null,
      org: 'org-name',
    },
    customPolicies: {},
    customRules: {},
    entitlements: {
      infrastructureAsCode: true,
      iacCustomRulesEntitlement: true,
    },
  };

  it('returns expected JSON result', () => {
    const result = convertEngineToJsonResults({
      results: snykIacTestFixture,
      projectName: 'org-name',
      orgSettings,
    });

    expect(result).toEqual(experimentalJsonOutputFixture);
  });
});
