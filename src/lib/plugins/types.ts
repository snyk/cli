import {InspectOptions } from '@snyk/cli-interface/dist/legacy/plugin';

export type Options = CliInspectOptions & InspectOptions;

interface CliInspectOptions {
  file?: string;
  docker?: boolean;
  traverseNodeModules?: boolean;
  dev?: boolean;
  strictOutOfSync?: boolean | 'true' | 'false';
  debug?: boolean;
  packageManager?: string;
  composerIsFine?: boolean;
  composerPharIsFine?: boolean;
  systemVersions?: object;
}
