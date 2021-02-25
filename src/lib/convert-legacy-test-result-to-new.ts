import { DepGraphData } from '@snyk/dep-graph';
import { TestResult } from './ecosystems/types';
import { TestResult as LegacyTestResult } from './snyk-test/legacy';

export function convertLegacyTestResultToNew(
  testResult: LegacyTestResult,
): TestResult {
  return {
    issuesData: {} as any, // TODO: add converter
    issues: [], // TODO: add converter
    remediation: testResult.remediation,
    depGraphData: {} as DepGraphData, // TODO: add converter + need to get this from the scan
  };
}
