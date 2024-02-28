import * as fs from 'fs';
import * as path from 'path';
import * as sarif from 'sarif';
import { pathToFileURL } from 'url';

import { TestOutput } from '../../../../../../../src/lib/iac/test/v2/scan/results';
import { convertEngineToSarifResults } from '../../../../../../../src/lib/iac/test/v2/sarif';
describe('convertEngineToSarifResults', () => {
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
  const snykIacTestFixture: TestOutput = JSON.parse(snykIacTestFixtureContent);

  const integratedSarifOutputFixtureContent = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'iac',
      'process-results',
      'fixtures',
      'integrated-sarif-output.json',
    ),
    'utf-8',
  );
  const integratedSarifOutputFixture: sarif.Log = JSON.parse(
    integratedSarifOutputFixtureContent,
  );

  integratedSarifOutputFixture.runs[0].originalUriBaseIds!.PROJECTROOT.uri = pathToFileURL(
    process.cwd() + '/',
  ).href;

  it('returns expected SARIF result', () => {
    const result = convertEngineToSarifResults(snykIacTestFixture);

    expect(result).toEqual(integratedSarifOutputFixture);
  });
});
