import { SupportedPackageManagers } from './package-managers';
import { IacProjectTypes, IacFileTypes } from './iac/constants';
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
  pruneRepeatedSubdependencies?: boolean;
  showVulnPaths: ShowVulnPaths;
  failOn?: FailOn;
  reachableVulns?: boolean;
  reachableVulnsTimeout?: number;
  initScript?: string;
  yarnWorkspaces?: boolean;
  testDepGraphDockerEndpoint?: string | null;
  isDockerUser?: boolean;
  iacDirFiles?: IacFileInDirectory[];
}

export interface WizardOptions {
  newPolicy: boolean;
}

export interface Contributor {
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
  code?: boolean;
  source?: boolean; // C/C++ Ecosystem Support
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
  debug?: boolean;
  sarif?: boolean;
  'group-issues'?: boolean;
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
  pruneRepeatedSubdependencies?: boolean;
  // Used with the Docker plugin only. Allows requesting some experimental/unofficial features.
  experimental?: boolean;
  // Used with the Docker plugin only. Allows application scanning.
  'app-vulns'?: boolean;
  reachableVulns?: boolean;
  reachableVulnsTimeout?: number;
  initScript?: string;
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

export interface OutputDataTypes {
  stdout: any;
  stringifiedData: string;
  stringifiedJsonData: string;
  stringifiedSarifData: string;
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
  | 'reachable'
  | 'reachable-vulns'
  | 'reachable-timeout'
  | 'reachable-vulns-timeout'
  | 'init-script'
  | 'integration-name'
  | 'integration-version';

export enum SupportedCliCommands {
  version = 'version',
  help = 'help',
  // config = 'config', // TODO: cleanup `$ snyk config` parsing logic before adding it here
  // auth = 'auth', // TODO: auth does not support argv._ at the moment
  test = 'test',
  monitor = 'monitor',
  protect = 'protect',
  policy = 'policy',
  ignore = 'ignore',
  wizard = 'wizard',
  woof = 'woof',
}

export interface IacFileInDirectory {
  filePath: string;
  fileType: IacFileTypes;
  projectType?: IacProjectTypes;
  failureReason?: string;
}
