import { DepGraphData } from '@snyk/dep-graph';
import { SEVERITY } from '../snyk-test/common';
import { LegalInstruction, RemediationChanges } from '../snyk-test/legacy';
import { Options } from '../types';

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
  [issueId: string]: EnrichedVulnData;
}

export interface EnrichedVulnData extends RawVulnData {
  // backwards compatibility for cli only
  legalInstructions?: string;
  legalInstructionsArray?: LegalInstruction[];
}

export type VulnType = 'vuln' | 'license';

export interface RawVulnData {
  readonly type?: VulnType;
  readonly CVSSv3: string;
  readonly alternativeIds: string[];
  readonly creationTime: string;
  readonly disclosureTime: string;
  readonly modificationTime: string;
  readonly publicationTime: string;
  readonly cvssScore: number;
  readonly credit: string[];
  readonly id: string;
  readonly packageManager: string;
  readonly packageName: string;
  readonly language: string;
  readonly severity: SEVERITY;
  readonly severityWithCritical: SEVERITY;
  readonly originalSEVERITY?: SEVERITY;
  readonly fixedIn?: string[];
  readonly functions: string[]; // deprecated, this is an old format - please use `functions_new`
  readonly functions_new?: VulnerableFunction[]; // contains the vulnerable function location
  readonly mavenModuleName?: MavenModuleName;
  readonly semver: {
    vulnerable: string | string[];
    vulnerableHashes?: string[];
    vulnerableByDistro?: {
      [distroNameAndVersion: string]: string[];
    };
  };
  readonly references: object[];
  readonly internal: object;
  readonly identifiers: {
    [name: string]: string[];
  };
  readonly patches: Patch[];
  readonly title: string;
  readonly description: string;
  readonly exploit: RawExploitTypes;
  readonly license?: string;
  readonly proprietary?: boolean;
  readonly nearestFixedInVersion?: string;
}

interface MavenModuleName {
  groupId: string;
  artifactId: string;
}

interface Patch {
  version: string;
  id: string;
  urls: string[];
  modificationTime: string;
}

// this matches the type of data of rawExploitMaturity.
export enum RawExploitTypes {
  NO_DATA = 'No Data',
  NOT_DEFINED = 'Not Defined',
  UNPROVEN = 'Unproven',
  PROOF_OF_CONCEPT = 'Proof of Concept',
  FUNCTIONAL = 'Functional',
  HIGH = 'High',
}

export interface VulnerableFunction {
  functionId: FunctionId;
  version: string[];
}
interface FunctionId {
  className: string;
  functionName: string;
}

export interface TestResult {
  issues: Issue[];
  issuesData: IssuesData;
  depGraphData: DepGraphData;
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
}
