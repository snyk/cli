import { DepGraphData } from '@snyk/dep-graph';

/* Scan Result
 * this data is returned by the CLI plugins to identify
 * what should be scanned for issues
 */
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

/* Test Result
 * this data is returned on a `snyk test` for supported project types
 * after the relevant plugin extracts dependencies
 */
export interface TestResult {
  issues: Issue[];
  issuesData: IssuesData;
  depGraphData: DepGraphData;
  remediation?: RemediationChanges; // TODO: not yet in the CLI TestResults type
}

export interface Issue {
  pkgName: string;
  pkgVersion?: string;
  issueId: string;
  fixInfo: FixInfo;
}

interface UpgradePath {
  path: UpgradePathItem[];
}

export interface FixInfo {
  upgradePaths: UpgradePath[];
  isPatchable: boolean;
  nearestFixedInVersion?: string;
}

interface UpgradePathItem {
  name: string;
  version: string;
  newVersion?: string;
  isDropped?: boolean;
}
export interface IssuesData {
  [issueId: string]: {
    id: string;
    severity: string;
    title: string;
  };
}

/* Remediation Data
 * this data is returned on a `snyk test` for supported project types
 */
export interface Upgrade {
  upgradeTo: string; // name@version
}

export interface UpgradeVulns extends Upgrade {
  vulns: string[];
}
export interface UpgradeRemediation extends UpgradeVulns {
  upgrades: string[];
}

export interface PatchRemediation {
  paths: PatchObject[];
}

export interface DependencyUpdates {
  [from: string]: UpgradeRemediation;
}

export interface PinRemediation extends UpgradeVulns {
  isTransitive: boolean;
}

// Remediation changes to be applied to the project,
// including information on all and unresolved issues.
export interface RemediationChanges {
  unresolved: IssueData[];
  upgrade: DependencyUpdates;
  patch: {
    [name: string]: PatchRemediation;
  };
  ignore: unknown;
  pin: DependencyUpdates;
}

export interface IssueData {
  id: string;
  packageName: string;
  version: string;
  moduleName?: string;
  below: string; // Vulnerable below version
  semver: {
    vulnerable: string | string[];
    vulnerableHashes?: string[];
    vulnerableByDistro?: {
      [distroNameAndVersion: string]: string[];
    };
  };
  patches: Patch[];
  isNew: boolean;
  description: string;
  title: string;
  severity: SEVERITY;
  fixedIn: string[];
  legalInstructions?: string;
  reachability?: REACHABILITY;
}

interface Patch {
  version: string;
  id: string;
  urls: string[];
  modificationTime: string;
}

export enum REACHABILITY {
  FUNCTION = 'function',
  PACKAGE = 'package',
  NOT_REACHABLE = 'not-reachable',
  NO_INFO = 'no-info',
}

export interface PatchObject {
  [name: string]: {
    patched: string;
  };
}

export enum SEVERITY {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/* End Remediation Data
 */

/* Python fix types
 * Types for concepts introduced as part of this lib
 */

export type SupportedScanTypes = 'pip';

export interface EntityToFix {
  workspace: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
  };
  scanResult: ScanResult;
  testResult: TestResult;
}
