import { SupportedPackageManagers } from './package-managers';

// TODO(kyegupov): use a shared repository snyk-cli-interface

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

export interface DepTree {
  name: string;
  version: string;
  dependencies?: DepDict;
  packageFormatVersion?: string;
  docker?: any;
  files?: any;
  targetFile?: string;

  labels?: {
    [key: string]: string;

    // Known keys:
    // pruned: identical subtree already presents in the parent node.
    //         See --prune-repeated-subdependencies flag.
  };
}

export interface DepRoot {
  depTree: DepTree; // to be soon replaced with depGraph
  targetFile?: string;
}

// Legacy result type. Will be deprecated soon.
export interface SingleDepRootResult {
  plugin: PluginMetadata;
  package: DepTree;
}

export interface MultiDepRootsResult {
  plugin: PluginMetadata;
  depRoots: DepRoot[];
}

// https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards
export function isMultiResult(pet: SingleDepRootResult | MultiDepRootsResult): pet is MultiDepRootsResult {
  return !!(pet as MultiDepRootsResult).depRoots;
}

export interface TestOptions {
  traverseNodeModules: boolean;
  interactive: boolean;
}
export interface ProtectOptions {
  loose: boolean;
}
export interface Options {
  org: string;
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
  'all-sub-projects'?: boolean; // Corresponds to multiDepRoot in plugins
  'project-name'?: string;
  'show-vulnerable-paths'?: string;
  showVulnPaths?: boolean;
  packageManager: SupportedPackageManagers;
  advertiseSubprojectsCount?: number;
  subProjectNames?: string[];
  severityThreshold?: string;
  dev?: boolean;
  'print-deps'?: boolean;
}

// TODO(kyegupov): catch accessing ['undefined-properties'] via noImplicitAny
export interface MonitorOptions {
  id?: string;
  docker?: boolean;
  file?: string;
  policy?: string;
  json?: boolean;
  'all-sub-projects'?: boolean; // Corresponds to multiDepRoot in plugins
  'project-name'?: string;
  'print-deps'?: boolean;
  'experimental-dep-graph'?: boolean;

  // An experimental flag to allow monitoring of bigtrees (with degraded deps info and remediation advice).
  'prune-repeated-subdependencies'?: boolean;
}

export interface MonitorMeta {
  'method': 'cli';
  'packageManager': SupportedPackageManagers;
  'policy-path': string;
  'project-name': string;
  'isDocker': boolean;
  'prune': boolean;
  'experimental-dep-graph'?: boolean;
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
