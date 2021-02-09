import { DepGraphData } from '@snyk/dep-graph';
import { EntityToFix, ScanResult, TestResult, FixInfo } from '../../src/types';

export function generateEntityToFix(type: string, targetFile: string): EntityToFix {
  const scanResult = generateScanResult(type, targetFile);
  const testResult = generateTestResult();
  return { scanResult, testResult };
}

function generateScanResult(type: string, targetFile: string): ScanResult {
  return {
    identity: {
      type,
      targetFile,
    },
    facts: [
      {
        type: 'not-implemented',
        data: 'not-implemented',
      },
    ],
  };
}

function generateTestResult(): TestResult {
  const issueId = 'VULN_ID_1';
  return {
    issues: [
      {
        pkgName: 'package@version',
        issueId,
        fixInfo: ({} as unknown) as FixInfo,
      },
    ],
    issuesData: {
      'vuln-id': {
        id: issueId,
        severity: 'high',
        title: 'Fake vuln',
      },
    },
    depGraphData: ('' as unknown) as DepGraphData,
  };
}
