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
  traverseNodeModules?: boolean;
  pruneRepeatedSubdependencies?: boolean;
  showVulnPaths: ShowVulnPaths;
  maxVulnPaths?: number;
  failOn?: FailOn;
  initScript?: string;
  yarnWorkspaces?: boolean;
  gradleSubProject?: boolean;
  command?: string; // python interpreter to use for python tests
  testDepGraphDockerEndpoint?: string | null;
  isDockerUser?: boolean;
}

export interface Contributor {
  email: string;
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
  unmanaged?: boolean; // C/C++ Ecosystem Support
  file?: string;
  policy?: string;
  json?: boolean;
  vulnEndpoint?: string;
  projectName?: string;
  insecure?: boolean;
  'dry-run'?: boolean;
  allSubProjects?: boolean;
  mavenAggregateProject?: boolean;
  'project-name'?: string;
  'show-vulnerable-paths'?: string;
  packageManager?: SupportedPackageManagers;
  advertiseSubprojectsCount?: number;
  projectNames?: string[];
  severityThreshold?: SEVERITY;
  dev?: boolean;
  'print-deps'?: boolean;
  'print-tree'?: boolean;
  'print-dep-paths'?: boolean;
  'remote-repo-url'?: string;
  criticality?: string;
  scanAllUnmanaged?: boolean;
  allProjects?: boolean;
  detectionDepth?: number;
  exclude?: string;
  strictOutOfSync?: boolean;
  // Used only with the IaC mode & Docker plugin. Allows requesting some experimental/unofficial features.
  experimental?: boolean;
  // Used with the Docker plugin only. Allows application scanning.
  'app-vulns'?: boolean;
  'exclude-app-vulns'?: boolean;
  'exclude-node-modules'?: boolean;
  debug?: boolean;
  sarif?: boolean;
  'group-issues'?: boolean;
  quiet?: boolean;
  'fail-fast'?: boolean;
  tags?: string;
  'target-reference'?: string;
  'exclude-base-image-vulns'?: boolean;
  'no-markdown'?: boolean;
  'max-depth'?: number;
  report?: boolean;
  'var-file'?: string;
  'target-name'?: string;
  // Used only with the Code (SAST) plugin. Allows running tests with reporting for existing projects.
  'project-id'?: string;
  'commit-id'?: string;

  // Policy
  'ignore-policy'?: boolean; // used in snyk/policy lib
  'trust-policies'?: boolean; // used in snyk/policy lib
  'policy-path'?: string;
  loose?: boolean;

  // DescribeOptions
  kind?: string;
  filter?: string;
  to?: string;
  'fetch-tfstate-headers'?: string;
  'tfc-token'?: string;
  'tfc-endpoint'?: string;
  'tf-provider-version'?: string;
  strict?: true;
  driftignore?: string;
  'tf-lockfile'?: string;
  'config-dir'?: string;
  html?: boolean;
  'html-file-output'?: string;
  service?: string;
  from?: string; // snyk cli args parsing does not support variadic args so this will be coma separated values
  ignore?: string[];

  id?: string;

  // GenDriftIgnoreOptions
  'exclude-missing'?: boolean;
  'exclude-unmanaged'?: boolean;

  // Feature Flags
  useImprovedDotnetWithoutPublish?: boolean;
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
  'print-dep-paths'?: boolean;
  'target-reference'?: string;
  scanAllUnmanaged?: boolean;
  allProjects?: boolean;
  // An experimental flag to allow monitoring of bigtrees (with degraded deps info and remediation advice).
  pruneRepeatedSubdependencies?: boolean;
  // Used with the Docker plugin only. Allows requesting some experimental/unofficial features.
  experimental?: boolean;
  // Used with the Docker plugin only. Allows application scanning.
  'app-vulns'?: boolean;
  'exclude-app-vulns'?: boolean;
  'exclude-node-modules'?: boolean;
  initScript?: string;
  yarnWorkspaces?: boolean;
  'max-depth'?: number;
}

export interface MonitorMeta {
  method: 'cli';
  packageManager: SupportedPackageManagers;
  'policy-path': string;
  'project-name': string;
  isDocker: boolean;
  prune: boolean;
  'remote-repo-url'?: string;
  targetReference?: string;
  assetsProjectName?: boolean;
}

export interface Tag {
  key: string;
  value: string;
}

export interface ProjectAttributes {
  criticality?: PROJECT_CRITICALITY[];
  environment?: PROJECT_ENVIRONMENT[];
  lifecycle?: PROJECT_LIFECYCLE[];
}

export enum PROJECT_CRITICALITY {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum PROJECT_ENVIRONMENT {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  MOBILE = 'mobile',
  SAAS = 'saas',
  ONPREM = 'onprem',
  HOSTED = 'hosted',
  DISTRIBUTED = 'distributed',
}

export enum PROJECT_LIFECYCLE {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  SANDBOX = 'sandbox',
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
  | 'all-projects'
  | 'all-sub-projects'
  | 'detection-depth'
  | 'docker'
  | 'dry-run'
  | 'sequential'
  | 'fail-on'
  | 'file'
  | 'gradle-sub-project'
  | 'ignore-policy'
  | 'init-script'
  | 'integration-name'
  | 'integration-version'
  | 'json'
  | 'package-manager'
  | 'packages-folder'
  | 'policy'
  | 'project-name'
  | 'prune-repeated-subdependencies'
  | 'rules'
  | 'scan-all-unmanaged'
  | 'severity-threshold'
  | 'show-vulnerable-paths'
  | 'skip-unresolved'
  | 'strict-out-of-sync'
  | 'sub-project'
  | 'trust-policies'
  | 'yarn-workspaces'
  | 'maven-aggregate-project'
  | 'gradle-normalize-deps';

export enum SupportedCliCommands {
  version = 'version',
  about = 'about',
  help = 'help',
  // config = 'config', // TODO: cleanup `$ snyk config` parsing logic before adding it here
  // auth = 'auth', // TODO: auth does not support argv._ at the moment
  test = 'test',
  monitor = 'monitor',
  fix = 'fix',
  protect = 'protect',
  policy = 'policy',
  ignore = 'ignore',
  wizard = 'wizard',
  woof = 'woof',
  log4shell = 'log4shell',
  apps = 'apps',
  drift = 'drift',
  describe = 'describe',
  'update-exclude-policy' = 'update-exclude-policy',
}

export interface IacFileInDirectory {
  filePath: string;
  fileType: IacFileTypes;
  projectType?: IacProjectTypes;
  failureReason?: string;
}

export interface IacOutputMeta {
  projectName: string;
  orgName: string;
  gitRemoteUrl?: string;
}
