import * as depGraphLib from '@snyk/dep-graph';
import { GitTarget, ContainerTarget } from '../project-metadata/types';
import { DepTree } from '../types';

interface PayloadBody {
  depGraph?: depGraphLib.DepGraph; // missing for legacy endpoint (options.vulnEndpoint)
  callGraph?: any;
  policy?: string;
  targetFile?: string;
  targetFileRelativePath?: string;
  projectNameOverride?: string;
  hasDevDependencies?: boolean;
  originalProjectName?: string; // used only for display
  foundProjectCount?: number; // used only for display
  docker?: any;
  displayTargetFile?: string;
  target?: GitTarget | ContainerTarget | null;
}

export interface DepTreeFromResolveDeps extends DepTree {
  numDependencies: number;
  pluck: any;
}

export interface Payload {
  method: string;
  url: string;
  json: boolean;
  headers: {
    'x-is-ci': boolean;
    authorization: string;
  };
  body?: PayloadBody | CloudConfigPayloadBody;
  qs?: object | null;
  modules?: DepTreeFromResolveDeps;
}

export interface CloudConfigPayloadBody {
  policy: string;
  targetFile?: string;
  targetFileRelativePath?: string;
  originalProjectName?: string; // used only for display
  foundProjectCount?: number; // used only for display
  displayTargetFile?: string;
  target?: GitTarget | ContainerTarget | null;
  fileContent: string;
}
