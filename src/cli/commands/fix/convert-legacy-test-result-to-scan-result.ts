import { ScanResult } from '../../../lib/ecosystems/types';
import { LegacyTestResult } from '../../../lib/snyk-test/legacy';

export function convertLegacyTestResultToScanResult(
  testResult: LegacyTestResult,
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
    name: testResult.projectName,
    // TODO: grab this once Ecosystems flow starts sending back ScanResult
    facts: [],
    policy: testResult.policy,
    // TODO: grab this once Ecosystems flow starts sending back ScanResult
    target: {} as any,
  };
}
