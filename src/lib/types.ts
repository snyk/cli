import * as depGraphLib from '@snyk/dep-graph';

// TODO(kyegupov): use a shared repository snyk-cli-interface

export interface PluginMetadata {
  name: string;
  packageFormatVersion?: string;
  packageManager: string;
  imageLayers?: any;
  targetFile?: string; // this is wrong (because Shaun said it)
  runtime?: any;
  dockerImageId: any;
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

export interface Package {
  plugin: PluginMetadata;
  depRoots?: DepRoot[]; // currently only returned by gradle
  package?: DepTree;
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
