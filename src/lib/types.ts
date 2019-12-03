import { SupportedPackageManagers } from './package-managers';
import { legacyCommon as legacyApi } from '@snyk/cli-interface';
import { SEVERITY } from './snyk-test/legacy';

export interface PluginMetadata {
  name: string;
  packageFormatVersion?: string;
  packageManager: SupportedPackageManagers;
  imageLayers?: any;
  targetFile?: string; // this is wrong (because Shaun said it)
  runtime?: any;
  dockerImageId: any;
  meta?: {
    allSubProjectNames: string[]; // To warn the user about subprojects not being scanned
  };
}

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
  pinningSupported?: boolean;
}
export interface ProtectOptions {
  loose: boolean;
}
export interface Options {
  org: string | null;
  path: string;
  docker?: boolean;
  file?: string;
  policy?: string;
  json?: boolean;
  vulnEndpoint?: string;
  projectName?: string;
  insecure?: boolean;
  'dry-run'?: boolean;
  'ignore-policy'?: boolean;
  'trust-policies'?: boolean; // used in snyk/policy lib
  'policy-path'?: boolean;
  allSubProjects?: boolean;
  'project-name'?: string;
  'show-vulnerable-paths'?: string;
  packageManager: SupportedPackageManagers;
  advertiseSubprojectsCount?: number;
  projectNames?: string[];
  severityThreshold?: SEVERITY;
  dev?: boolean;
  'print-deps'?: boolean;
  'remote-repo-url'?: string;
  scanAllUnmanaged?: boolean;
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

  // An experimental flag to allow monitoring of bigtrees (with degraded deps info and remediation advice).
  'prune-repeated-subdependencies'?: boolean;
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
