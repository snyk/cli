import { SupportedPackageManagers } from './package-managers';
import { IacProjectTypes } from './iac/iac-projects';
import { legacyCommon as legacyApi } from '@snyk/cli-interface';
import { SEVERITY } from './snyk-test/legacy';
import { FailOn } from './snyk-test/common';

export interface DepDict {
  [name: string]: DepTree;
}

export type DepTree = legacyApi.DepTree;

export type ShowVulnPaths = 'none' | 'some' | 'all';

export interface TestOptions {
  traverseNodeModules: boolean;
  interactive: boolean;
  'prune-repeated-subdependencies'?: boolean;
  showVulnPaths: ShowVulnPaths;
  failOn?: FailOn;
  reachableVulns?: boolean;
  yarnWorkspaces?: boolean;
}

export interface WizardOptions {
  newPolicy: boolean;
}

export interface Contributors {
  userId: string;
  lastCommitDate: string;
}

export interface PolicyOptions {
  'ignore-policy'?: boolean; // used in snyk/policy lib
  'trust-policies'?: boolean; // used in snyk/policy lib
  'policy-path'?: string;
  loose?: boolean;
}

export interface Options {
  org?: string | null;
  path: string;
  docker?: boolean;
  iac?: boolean;
  file?: string;
  policy?: string;
  json?: boolean;
  vulnEndpoint?: string;
  projectName?: string;
  insecure?: boolean;
  'dry-run'?: boolean;
  allSubProjects?: boolean;
  'project-name'?: string;
  'show-vulnerable-paths'?: string;
  packageManager?: SupportedPackageManagers;
  advertiseSubprojectsCount?: number;
  projectNames?: string[];
  severityThreshold?: SEVERITY;
  dev?: boolean;
  'print-deps'?: boolean;
  'remote-repo-url'?: string;
  scanAllUnmanaged?: boolean;
  allProjects?: boolean;
  detectionDepth?: number;
  exclude?: string;
  strictOutOfSync?: boolean;
  // Used with the Docker plugin only. Allows requesting some experimental/unofficial features.
  experimental?: boolean;
  // Used with the Docker plugin only. Allows application scanning.
  'app-vulns'?: boolean;
}

// TODO(kyegupov): catch accessing ['undefined-properties'] via noImplicitAny
export interface MonitorOptions {
  id?: string;
  docker?: boolean;
  file?: string;
  policy?: string;
  json?: boolean;
  allSubProjects?: boolean;
  'project-name'?: string;
  'print-deps'?: boolean;
  'experimental-dep-graph'?: boolean;
  scanAllUnmanaged?: boolean;
  allProjects?: boolean;
  // An experimental flag to allow monitoring of bigtrees (with degraded deps info and remediation advice).
  'prune-repeated-subdependencies'?: boolean;
  // Used with the Docker plugin only. Allows requesting some experimental/unofficial features.
  experimental?: boolean;
  // Used with the Docker plugin only. Allows application scanning.
  'app-vulns'?: boolean;
  reachableVulns?: boolean;
  yarnWorkspaces?: boolean;
}

export interface MonitorMeta {
  method: 'cli' | 'wizard';
  packageManager: SupportedPackageManagers;
  'policy-path': string;
  'project-name': string;
  isDocker: boolean;
  prune: boolean;
  'experimental-dep-graph'?: boolean;
  'remote-repo-url'?: string;
}

export interface PackageJson {
  scripts: any;
  snyk: boolean;
  dependencies: any;
  devDependencies: any;
}
export interface MonitorResult {
  org?: string;
  id: string;
  path: string;
  licensesPolicy: any;
  uri: string;
  isMonitored: boolean;
  trialStarted: boolean;
}

export interface SpinnerOptions {
  stream?: NodeJS.WriteStream;
  tty?: any;
  string?: string;
  interval?: any;
  delay?: any;
  label?: string;
  unref?: any;
  cleanup?: any;
}

export type SupportedProjectTypes = IacProjectTypes | SupportedPackageManagers;

// TODO: finish typing this there are many more!
export type SupportedUserReachableFacingCliArgs =
  | 'severity-threshold'
  | 'prune-repeated-subdependencies'
  | 'ignore-policy'
  | 'trust-policies'
  | 'docker'
  | 'file'
  | 'policy'
  | 'fail-on'
  | 'reachable-vulns'
  | 'json'
  | 'package-manager'
  | 'packages-folder'
  | 'severity-threshold'
  | 'strict-out-of-sync'
  | 'all-sub-projects'
  | 'sub-project'
  | 'gradle-sub-project'
  | 'skip-unresolved'
  | 'scan-all-unmanaged'
  | 'fail-on'
  | 'all-projects'
  | 'yarn-workspaces'
  | 'detection-depth'
  | 'project-name'
  | 'reachable-vulns';

export type SupportedCliCommands =
  | 'protect'
  | 'test'
  | 'monitor'
  | 'wizard'
  | 'ignore'
  | 'woof';
