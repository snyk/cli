import { DepGraphData } from '@snyk/dep-graph';
import { CustomError } from './lib/errors/custom-error';

/* Scan Result
 * this data is returned by the CLI plugins to identify
 * what should be scanned for issues
 */
export interface GitTarget {
  remoteUrl?: string;
  branch?: string;
}
export interface ContainerTarget {
  image: string;
}

interface UnknownTarget {
  name: string; // Should be equal to the project name
}

export interface ScanResult {
  readonly identity: Identity;
  readonly facts: Facts[];
  readonly name?: string;
  readonly policy?: string;
  readonly target?: GitTarget | ContainerTarget | UnknownTarget;
}

export interface Identity {
  type: string;
  targetFile?: string;
  // options used to scan should be here
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
  readonly issues: Issue[];
  readonly issuesData: IssuesData;
  readonly depGraphData: DepGraphData;
  readonly remediation?: RemediationChanges; // TODO: not yet in the CLI TestResults type
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
  upgradePaths?: UpgradePath[];
  isPatchable?: boolean;
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
    severity: SEVERITY;
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

export interface DependencyPins {
  [name: string]: PinRemediation;
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
  pin: DependencyPins;
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

/* Snyk fix types
 * Types for concepts introduced as part of this lib
 */

export type SupportedScanTypes = 'pip';

export interface Workspace {
  path: string;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
}
export interface EntityToFix {
  readonly workspace: Workspace;
  readonly scanResult: ScanResult;
  readonly testResult: TestResult;
  readonly options: CliTestOptions;
}

// Partial CLI test options interface
// defining only what is used by @snyk/fix
// add more as needed
interface BaseTestOptions {
  packageManager?: string;
}
export interface PythonTestOptions extends BaseTestOptions {
  command?: string; // python interpreter to use for python tests
  dev?: boolean;
}
export type CliTestOptions = PythonTestOptions;
export interface WithError<Original> {
  original: Original;
  error: CustomError;
  tip?: string;
}

export interface WithAttemptedFixChanges<Original> {
  original: Original;
  changes: FixChangesSummary[];
}

export interface WithUserMessage<Original> {
  original: Original;
  userMessage: string;
}

export type FixChangesSummary = FixChangesSuccess | FixChangesError;

export interface FixChangesSuccess {
  success: true;
  userMessage: string;
  issueIds: string[];
  from?: string;
  to?: string;
}

export interface FixChangesError {
  success: false;
  userMessage: string;
  reason: string;
  tip?: string;
  issueIds: string[];
  from?: string;
  to?: string;
}

export interface ErrorsByEcoSystem {
  [ecosystem: string]: { originals: EntityToFix[]; userMessage: string };
}
export interface FixOptions {
  dryRun?: boolean;
  quiet?: boolean;
  stripAnsi?: boolean;
  sequentialFix?: boolean;
}

export interface FixedMeta {
  fixed: number;
  failed: number;
  fixableIssues: number;
  fixedIssues: number;
  totalIssues: number;
}
