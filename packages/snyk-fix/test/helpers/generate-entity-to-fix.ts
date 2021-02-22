import { DepGraphData } from '@snyk/dep-graph';
import { EntityToFix, ScanResult, TestResult, FixInfo } from '../../src/types';

export function generateEntityToFix(
  type: string,
  targetFile: string,
  contents: string,
): EntityToFix {
  const scanResult = generateScanResult(type, targetFile);
  const testResult = generateTestResult();
  const workspace = generateWorkspace(contents);
  return { scanResult, testResult, workspace };
}

function generateWorkspace(contents: string) {
  return {
    readFile: async () => {
      return contents;
    },
    writeFile: async () => {
      return;
    },
  };
}
export function generateScanResult(
  type: string,
  targetFile: string,
): ScanResult {
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

export function generateTestResult(): TestResult {
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
    remediation: {
      unresolved: [],
      upgrade: {},
      patch: {},
      ignore: {},
      pin: {
        'django@1.6.1': {
          upgradeTo: 'django@2.0.1',
          vulns: [],
          upgrades: [],
        },
      },
    },
  };
}
