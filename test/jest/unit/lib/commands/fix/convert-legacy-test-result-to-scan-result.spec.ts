import * as fs from 'fs';
import { convertLegacyTestResultToScanResult } from '../../../../../../src/cli/commands/fix/convert-legacy-test-result-to-scan-result';
import { getFixturePath } from '../../../../util/getFixturePath';

describe('Convert legacy TestResult to ScanResult', () => {
  it('can convert npm test result with no remediation', () => {
    const noRemediationRes = JSON.parse(
      fs.readFileSync(
        getFixturePath(
          'npm-package-with-severity-override/test-graph-result-no-remediation.json',
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
        getFixturePath(
          'npm-package-with-severity-override/test-graph-result-patches.json',
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
        getFixturePath('pip-app-with-remediation/test-graph-results.json'),
        'utf8',
      ),
    );
    const res = convertLegacyTestResultToScanResult(withRemediation);
    expect(res).toMatchSnapshot();
  });
});
