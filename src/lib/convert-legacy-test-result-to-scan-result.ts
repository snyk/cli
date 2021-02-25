import { ScanResult } from 'snyk-cpp-plugin';
import { TestResult } from './snyk-test/legacy';

export function convertLegacyTestResultToScanResult(
  testResult: TestResult,
): ScanResult {
  if (!testResult.packageManager) {
    throw new Error(
      'Only results with packageManagers are supported for conversion',
    );
  }
  return {
    identity: {
      type: testResult.packageManager,
      // this is because not all plugins send it back today, but we should always have it
      targetFile: testResult.targetFile || testResult.displayTargetFile,
    },
    name: testResult.projectName, // TODO: confirm
    facts: [
      // TODO: this needs to come from project Scan result
    ],
    policy: testResult.policy,
    target: {} as any, // TODO: this needs to come from project Scan result
  };
}
