import * as fs from 'fs';
import * as path from 'path';
import { IacOrgSettings } from '../../../../../../../src/cli/commands/test/iac/local-execution/types';
import { SnykIacTestError } from '../../../../../../../src/lib/iac/test/v2/errors';
import {
  convertEngineToJsonResults,
  Result,
} from '../../../../../../../src/lib/iac/test/v2/json';
import { ScanError } from '../../../../../../../src/lib/iac/test/v2/scan/results';

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

  const snykIacTestFixture = JSON.parse(snykIacTestFixtureContent);
  snykIacTestFixture.errors = snykIacTestFixture.errors?.map((item) => {
    const isError = 'code' in item;
    return isError ? new SnykIacTestError(item) : item;
  });

  const integratedJsonOutputFixtureContent = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'iac',
      'process-results',
      'fixtures',
      'integrated-json-output.json',
    ),
    'utf-8',
  );
  let integratedJsonOutputFixture: Array<Result | ScanError> = JSON.parse(
    integratedJsonOutputFixtureContent,
  );

  integratedJsonOutputFixture = integratedJsonOutputFixture.map((item) =>
    !('error' in item) ? { ...item, path: process.cwd() } : item,
  );

  const orgSettings: IacOrgSettings = {
    meta: {
      isPrivate: false,
      isLicensesEnabled: false,
      ignoreSettings: null,
      org: 'org-name',
      orgPublicId: '7bfa4159-6f90-4acd-82a4-0b2ad2aaf80b',
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

    integratedJsonOutputFixture.forEach((item) => {
      if ('targetFilePath' in item) {
        item.targetFilePath = path.resolve(item.targetFile);
      }
    });

    expect(result).toEqual(integratedJsonOutputFixture);
  });
});
