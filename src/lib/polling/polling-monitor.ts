import config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';

import { assembleQueryString } from '../../lib/snyk-test/common';
import { getAuthHeader } from '../api-token';
import { MonitorDependenciesResponse, ScanResult } from '../ecosystems/types';
import {
  ResolutionMeta,
  ResolveAndMonitorFactsResponse,
  ResolveFactsState,
} from './types';
import { delayNextStep } from './common';

export async function requestMonitorPollingToken(
  options: Options,
  isAsync: boolean,
  scanResult: ScanResult,
): Promise<ResolveFactsState> {
  if (scanResult?.target && scanResult.target['remoteUrl'] === '') {
    scanResult.target['remoteUrl'] = scanResult.name;
  }

  const payload = {
    method: 'PUT',
    url: `${config.API}/monitor-dependencies`,
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
    body: {
      isAsync,
      scanResult,
      method: 'cli',
    },
    qs: { ...assembleQueryString(options) },
  };
  return await makeRequest<ResolveAndMonitorFactsResponse>(payload);
}

export async function pollingMonitorWithTokenUntilDone(
  token: string,
  isAsync: boolean,
  options: Options,
  pollInterval: number,
  attemptsCount: number,
  maxAttempts = Infinity,
  resolutionMeta: ResolutionMeta | undefined,
): Promise<MonitorDependenciesResponse> {
  const payload = {
    method: 'PUT',
    url: `${config.API}/monitor-dependencies/${token}`,
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
    qs: { ...assembleQueryString(options) },
    body: {
      isAsync,
      resolutionMeta,
      method: 'cli',
      projectName:
        resolutionMeta?.name || options['project-name'] || config.PROJECT_NAME,
    },
  };

  const response = await makeRequest<ResolveAndMonitorFactsResponse>(payload);
  if (response.ok && response.isMonitored) {
    return response;
  }

  await delayNextStep(attemptsCount, maxAttempts, pollInterval);
  return await pollingMonitorWithTokenUntilDone(
    token,
    isAsync,
    options,
    pollInterval,
    attemptsCount,
    maxAttempts,
    resolutionMeta,
  );
}
