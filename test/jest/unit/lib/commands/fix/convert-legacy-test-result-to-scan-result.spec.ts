import * as fs from 'fs';
import * as path from 'path';

import { convertLegacyTestResultToScanResult } from '../../../../../../src/cli/commands/fix/convert-legacy-test-result-to-scan-result';

describe('Convert legacy TestResult to ScanResult', () => {
  it('can convert npm test result with no remediation', () => {
    const noRemediationRes = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../../',
          'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-no-remediation.json',
        ),
        'utf8',
      ),
    );
    const res = convertLegacyTestResultToScanResult(noRemediationRes);
    expect(res).toMatchSnapshot();
  });

  it('can convert npm test result with remediation', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../../',
          'acceptance/fixtures/npm-package-with-severity-override/test-graph-result-patches.json',
        ),
        'utf8',
      ),
    );
    const res = convertLegacyTestResultToScanResult(withRemediation);
    expect(res).toMatchSnapshot();
  });
  it('can convert pip test result with remediation (pins)', () => {
    const withRemediation = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../../../../',
          'acceptance/fixtures/pip-app-with-remediation/test-graph-results.json',
        ),
        'utf8',
      ),
    );
    const res = convertLegacyTestResultToScanResult(withRemediation);
    expect(res).toMatchSnapshot();
  });
});
