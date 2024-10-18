import * as fs from 'fs';
import * as pathLib from 'path';

import { readFileHelper } from './read-file-helper';

import { DepGraphData } from '@snyk/dep-graph';
import {
  EntityToFix,
  ScanResult,
  TestResult,
  FixInfo,
  SEVERITY,
} from '../../src/types';

export function generateEntityToFix(
  type: string,
  targetFile: string,
  contents: string,
  withVulns = true,
  path?: string,
): EntityToFix {
  const scanResult = generateScanResult(type, targetFile);
  const testResult = withVulns
    ? generateTestResult()
    : {
        issues: [],
        issuesData: {},
        depGraphData: '' as unknown as DepGraphData,
      };
  const workspace = generateWorkspace(contents, path);
  const cliTestOptions = {
    command: 'python3',
  };
  return { scanResult, testResult, workspace, options: cliTestOptions };
}

export function generateEntityToFixWithFileReadWrite(
  workspacesPath: string,
  targetFile: string,
  testResult: TestResult,
  options: {
    command?: string;
    dev?: boolean;
    packageManager?: string;
  } = {
    command: 'python3',
  },
): EntityToFix {
  const scanResult = generateScanResult('pip', targetFile);

  const workspace = {
    path: workspacesPath,
    readFile: async (path: string) => {
      return readFileHelper(workspacesPath, path);
    },
    writeFile: async (path: string, contents: string) => {
      const res = pathLib.parse(path);
      const fixedPath = pathLib.resolve(
        workspacesPath,
        res.dir,
        `fixed-${res.base}`,
      );
      fs.writeFileSync(fixedPath, contents, 'utf-8');
    },
  };
  return { scanResult, testResult, workspace, options };
}

function generateWorkspace(contents: string, path?: string) {
  return {
    path: path ?? '.',
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
        fixInfo: {} as FixInfo,
      },
    ],
    issuesData: {
      'vuln-id': {
        id: issueId,
        severity: SEVERITY.HIGH,
        title: 'Fake vuln',
      },
    },
    depGraphData: '' as unknown as DepGraphData,
    remediation: {
      unresolved: [],
      upgrade: {},
      patch: {},
      ignore: {},
      pin: {
        'django@1.6.1': {
          upgradeTo: 'django@2.0.1',
          vulns: ['vuln-id'],
          isTransitive: false,
        },
      },
    },
  };
}
