import { SupportedPackageManagers } from './package-managers';
import { DepTree } from '@snyk/cli-interface/dist/legacy/common';

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

export { DepTree };

export interface DepRoot {
  depTree: DepTree; // to be soon replaced with depGraph
  targetFile?: string;
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
  allSubProjects?: boolean; // Converted from dash case in args.ts
  'project-name'?: string;
  'show-vulnerable-paths'?: string;
  showVulnPaths?: boolean;
  packageManager: SupportedPackageManagers; // Converted from dash case in args.ts
  advertiseSubprojectsCount?: number;
  subProjectNames?: string[];
  severityThreshold?: string; // Converted from dash case in args.ts
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
