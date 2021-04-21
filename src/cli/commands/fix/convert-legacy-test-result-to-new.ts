import { DepGraphData } from '@snyk/dep-graph';
import { IssuesData, Issue, TestResult } from '../../../lib/ecosystems/types';
import {
  AnnotatedIssue,
  TestResult as LegacyTestResult,
} from '../../../lib/snyk-test/legacy';

function convertVulnerabilities(
  vulns: AnnotatedIssue[],
): {
  issuesData: IssuesData;
  issues: Issue[];
} {
  const issuesData: IssuesData = {};
  const issues: Issue[] = [];

  vulns.forEach((vuln) => {
    // TODO: map the rest as needed
    issuesData[vuln.id] = {
      id: vuln.id,
      severity: vuln.severity,
      title: vuln.title,
    } as any;
    issues.push({
      pkgName: vuln.packageName,
      pkgVersion: vuln.version,
      issueId: vuln.id,
      // TODO: add fixInfo when needed
      fixInfo: {} as any,
    });
  });
  return { issuesData, issues };
}

export function convertLegacyTestResultToNew(
  testResult: LegacyTestResult,
): TestResult {
  const { issues, issuesData } = convertVulnerabilities(
    testResult.vulnerabilities,
  );
  return {
    issuesData,
    issues,
    remediation: testResult.remediation,
    // TODO: grab this once Ecosystems flow starts sending back ScanResult
    depGraphData: {} as DepGraphData,
  };
}
