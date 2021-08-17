import {
  TestDepGraphMeta,
  TestDependenciesResult,
} from '../../snyk-test/legacy';
import {
  MonitorDependenciesResponse,
  GitTarget,
  ContainerTarget,
} from '../types';

type ResolveFactsStatus = 'CANCELLED' | 'ERROR' | 'PENDING' | 'RUNNING' | 'OK';

interface PollingTask {
  pollInterval: number;
  maxAttempts: number;
}

export interface ResolveAndTestFactsResponse {
  token: string;
  pollingTask: PollingTask;
  result?: TestDependenciesResult;
  meta?: TestDepGraphMeta;
  status?: ResolveFactsStatus;
  code?: number;
  error?: string;
  message?: string;
  userMessage?: string;
  resolutionMeta?: ResolutionMeta | undefined;
}

export interface ResolveAndMonitorFactsResponse {
  token: string;
  pollingTask: PollingTask;
  result?: MonitorDependenciesResponse;
  meta?: TestDepGraphMeta;
  status?: ResolveFactsStatus;
  code?: number;
  error?: string;
  message?: string;
  userMessage?: string;
  resolutionMeta?: ResolutionMeta | undefined;
}

export interface ResolutionMeta {
  name: string | undefined;
  identity: {
    type: string;
  };
  target?: GitTarget | ContainerTarget;
}
