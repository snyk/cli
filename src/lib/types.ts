import * as depGraphLib from '@snyk/dep-graph';
import { SupportedPackageManagers } from './package-managers';

// TODO(kyegupov): use a shared repository snyk-cli-interface

export interface PluginMetadata {
  name: string;
  packageFormatVersion?: string;
  packageManager: string;
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

export class MonitorError extends Error {
  public code?: number;
  public userMessage?: string;
}

export interface TestOptions {
  org: string;
  path: string;
  docker?: boolean;
  file?: string;
  policy?: string;
  json?: boolean;
  'all-sub-projects'?: boolean; // Corresponds to multiDepRoot in plugins
  'project-name'?: string;
  'show-vulnerable-paths'?: string;
  showVulnPaths?: boolean;
  packageManager: SupportedPackageManagers;
  advertiseSubprojectsCount?: number;
  subProjectNames?: string[];
  severityThreshold?: string;
}
