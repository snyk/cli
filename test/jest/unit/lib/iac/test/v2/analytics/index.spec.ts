import * as clonedeep from 'lodash.clonedeep';
import * as path from 'path';
import * as analytics from '../../../../../../../../src/lib/analytics';
import * as fs from 'fs';

import { SnykIacTestOutput } from '../../../../../../../../src/lib/iac/test/v2/scan/results';
import {
  addIacAnalytics,
  IacAnalytics,
} from '../../../../../../../../src/lib/iac/test/v2/analytics';

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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the expected analytics', async () => {
    const addedAnalytics: Record<string, any> = {};
    jest.spyOn(analytics, 'add').mockImplementation((key, value) => {
      addedAnalytics[key] = value;
    });

    const testConfig = {};
    const testOutput = clonedeep(snykIacTestOutputFixture);
    const expectedAnalytics = clonedeep(iacAnalyticsFixture);

    addIacAnalytics(testConfig, testOutput);

    expect(addedAnalytics).toStrictEqual(expectedAnalytics);
  });
});
