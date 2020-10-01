import { DepGraphData } from '@snyk/dep-graph';
import { Options } from '../types';

export type Ecosystem = 'cpp' | 'docker';

export interface PluginResponse {
  scanResults: ScanResult[];
}

export interface GitTarget {
  remoteUrl: string;
  branch: string;
}

export interface ContainerTarget {
  image: string;
}

export interface ScanResult {
  identity: Identity;
  facts: Facts[];
  name?: string;
  policy?: string;
  target?: GitTarget | ContainerTarget;
}

export interface Identity {
  type: string;
  targetFile?: string;
  args?: { [key: string]: string };
}

export interface Facts {
  type: string;
  data: any;
}

interface UpgradePathItem {
  name: string;
  version: string;
  newVersion?: string;
  isDropped?: boolean;
}

interface UpgradePath {
  path: UpgradePathItem[];
}

interface FixInfo {
  upgradePaths: UpgradePath[];
  isPatchable: boolean;
  nearestFixedInVersion?: string;
}

export interface Issue {
  pkgName: string;
  pkgVersion?: string;
  issueId: string;
  fixInfo: FixInfo;
}

export interface IssuesData {
  [issueId: string]: {
    id: string;
    severity: string;
    title: string;
  };
}

export interface TestResult {
  issues: Issue[];
  issuesData: IssuesData;
  depGraphData: DepGraphData;
}

export interface EcosystemPlugin {
  scan: (options: Options) => Promise<PluginResponse>;
  display: (
    scanResults: ScanResult[],
    testResults: TestResult[],
    errors: string[],
    options: Options,
  ) => Promise<string>;
}
