import { DepGraphData } from '@snyk/dep-graph';
import { TestResult } from '../../../lib/ecosystems/types';
import { TestResult as LegacyTestResult } from '../../../lib/snyk-test/legacy';

export function convertLegacyTestResultToNew(
  testResult: LegacyTestResult,
): TestResult {
  return {
    issuesData: {} as any, // TODO: add converter
    issues: [], // TODO: add converter
    remediation: testResult.remediation,
    // TODO: grab this once Ecosystems flow starts sending back ScanResult
    depGraphData: {} as DepGraphData,
  };
}
