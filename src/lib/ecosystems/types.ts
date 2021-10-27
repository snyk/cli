import { DepGraphData } from '@snyk/dep-graph';
import { SEVERITY } from '../snyk-test/common';
import { RemediationChanges } from '../snyk-test/legacy';
import { Options, ProjectAttributes, Tag } from '../types';

export type Ecosystem = 'cpp' | 'docker' | 'code';

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
  analytics?: Analytics[];
}

export interface Analytics {
  name: string;
  data: unknown;
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
    severity: SEVERITY;
    title: string;
  };
}

export interface DepsFilePaths {
  [pkgKey: string]: string[];
}

export interface TestResult {
  issues: Issue[];
  issuesData: IssuesData;
  depGraphData: DepGraphData;
  depsFilePaths?: DepsFilePaths;
  remediation?: RemediationChanges;
}

export interface EcosystemPlugin {
  scan: (options: Options) => Promise<PluginResponse>;
  display: (
    scanResults: ScanResult[],
    testResults: TestResult[],
    errors: string[],
    options: Options,
  ) => Promise<string>;
  test?: (
    paths: string[],
    options: Options,
  ) => Promise<{ readableResult: string }>;
}

export interface EcosystemMonitorError {
  error: string;
  path: string;
  scanResult: ScanResult;
}

export interface MonitorDependenciesResponse {
  ok: boolean;
  org: string;
  id: string;
  isMonitored: boolean;
  licensesPolicy: any;
  uri: string;
  trialStarted: boolean;
  path: string;
  projectName: string;
}

export interface EcosystemMonitorResult extends MonitorDependenciesResponse {
  scanResult: ScanResult;
}

export interface MonitorDependenciesRequest {
  scanResult: ScanResult;

  /**
   * If provided, overrides the default project name (usually equivalent to the root package).
   * @deprecated Must not be set by new code! Prefer to set the "scanResult.name" within your plugin!
   */
  projectName?: string;
  policy?: string;
  method?: 'cli';
  tags?: Tag[];
  attributes?: ProjectAttributes;
}
