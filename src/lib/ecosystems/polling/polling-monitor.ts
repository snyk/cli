import * as config from '../../config';
import { isCI } from '../../is-ci';
import { makeRequest } from '../../request/promise';
import { Options } from '../../types';

import { assembleQueryString } from '../../snyk-test/common';
import { getAuthHeader } from '../../api-token';
import { ScanResult } from '../types';
import { sleep } from '../../common';
import { ResolveAndMonitorFactsResponse } from './types';

export async function requestMonitorPollingToken(
  options: Options,
  isAsync: boolean,
  scanResult: ScanResult,
): Promise<ResolveAndMonitorFactsResponse> {
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
    },
    qs: assembleQueryString(options),
  };
  const response = await makeRequest<ResolveAndMonitorFactsResponse>(payload);
  return response;
}

export async function pollingMonitorWithTokenUntilDone(
  token: string,
  type: string,
  options: Options,
  pollInterval: number,
  attemptsCount: number,
  maxAttempts = Infinity,
  resolutionMeta,
): Promise<ResolveAndMonitorFactsResponse> {
  const payload = {
    method: 'PUT',
    url: `${config.API}/monitor-dependencies/${token}`,
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
    qs: { ...assembleQueryString(options), type },
    body: {
      resolutionMeta,
      method: 'cli',
      projectName:
        resolutionMeta?.meta ||
        options['project-name'] ||
        config.PROJECT_NAME ||
        undefined, // // move to plugin
    },
  };

  const response = await makeRequest<ResolveAndMonitorFactsResponse>(payload);

  const taskCompleted = (response as any).ok && (response as any).isMonitored;
  if (taskCompleted) {
    return response;
  }

  attemptsCount++;
  checkPollingAttempts(maxAttempts)(attemptsCount);
  await sleep(pollInterval);
  return await pollingMonitorWithTokenUntilDone(
    token,
    type,
    options,
    pollInterval,
    attemptsCount,
    maxAttempts,
    resolutionMeta,
  );
}

function checkPollingAttempts(maxAttempts: number) {
  return (attemptsCount: number) => {
    if (attemptsCount > maxAttempts) {
      throw new Error('Exceeded Polling maxAttempts');
    }
  };
}

function pollingMonitorRequestHasFailed(
  response: ResolveAndMonitorFactsResponse,
): boolean {
  const { token, result, meta, status, error, code, message } = response;
  const hasError = !!error && !!code && !!message;
  const pollingContextIsMissing = !token && !result && !meta && !status;
  return !!pollingContextIsMissing || hasError;
}
