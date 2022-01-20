import {
  TestDepGraphMeta,
  TestDependenciesResult,
} from '../../lib/snyk-test/legacy';

import {
  GitTarget,
  ContainerTarget,
  MonitorDependenciesResponse,
} from '../ecosystems/types';

export type ResolveFactsStatus =
  | 'CANCELLED'
  | 'ERROR'
  | 'PENDING'
  | 'RUNNING'
  | 'OK';

export interface PollingTask {
  pollInterval: number;
  maxAttempts: number;
}

export interface ResolveFactsState {
  token: string;
  pollingTask: PollingTask;
  meta?: TestDepGraphMeta;
  status?: ResolveFactsStatus;
  code?: number;
  error?: string;
  message?: string;
  userMessage?: string;
  resolutionMeta?: ResolutionMeta | undefined;
}
export interface TestDependenciesResponse {
  meta?: TestDepGraphMeta;
  result?: TestDependenciesResult;
}

export type ResolveAndTestFactsResponse = ResolveFactsState &
  TestDependenciesResponse;

export type ResolveAndMonitorFactsResponse = ResolveFactsState &
  MonitorDependenciesResponse;

export interface ResolutionMeta {
  name: string | undefined;
  identity: {
    type: string;
  };
  target?: GitTarget | ContainerTarget | {};
}
