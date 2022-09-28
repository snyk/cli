import * as clonedeep from 'lodash.clonedeep';
import * as path from 'path';
import * as fs from 'fs';

import { SnykIacTestOutput } from '../../../../../../../../src/lib/iac/test/v2/scan/results';
import {
  computeIacAnalytics,
  IacAnalytics,
} from '../../../../../../../../src/lib/iac/test/v2/analytics';

jest.mock(
  '../../../../../../../../src/lib/iac/test/v2/local-cache/policy-engine/constants',
  () => ({
    ...jest.requireActual(
      '../../../../../../../../src/lib/iac/test/v2/local-cache/policy-engine/constants',
    ),
    policyEngineReleaseVersion: 'test-policy-engine-release-version',
  }),
);

describe('computeIacAnalytics', () => {
  const snykIacTestOutputFixture: SnykIacTestOutput = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '..',
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
    ),
  );

  const iacAnalyticsFixture: IacAnalytics = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, 'fixtures', 'iac-analytics.json'),
      'utf-8',
    ),
  );

  it('generates the correct analytics', async () => {
    // Arrange
    const testOutput = clonedeep(snykIacTestOutputFixture);
    const expectedAnalytics = clonedeep(iacAnalyticsFixture);

    // Act
    const result = computeIacAnalytics(testOutput);

    // Assert
    expect(result).toStrictEqual(expectedAnalytics);
  });
});
