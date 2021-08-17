import * as config from '../../config';
import { isCI } from '../../is-ci';
import { makeRequest } from '../../request/promise';
import { Options } from '../../types';

import { assembleQueryString } from '../../snyk-test/common';
import { getAuthHeader } from '../../api-token';
import { ScanResult } from '../types';

import { sleep } from '../../common';
import {
  ResolveAndTestFactsResponse,
  ResolveAndMonitorFactsResponse,
} from './types';

export async function requestTestPollingToken(
  options: Options,
  isAsync: boolean,
  scanResult: ScanResult,
): Promise<ResolveAndTestFactsResponse | ResolveAndMonitorFactsResponse> {
  const payload = {
    method: 'POST',
    url: `${config.API}/test-dependencies`,
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
  const response = await makeRequest<ResolveAndTestFactsResponse>(payload);
  throwIfRequestPollingTokenFailed(response);
  return response;
}

function throwIfRequestPollingTokenFailed(res: ResolveAndTestFactsResponse) {
  const { token, status, pollingTask } = res;
  const { maxAttempts, pollInterval } = pollingTask;
  const isMissingPollingTask = !!maxAttempts && !!pollInterval;
  if (!token && !status && isMissingPollingTask) {
    throw 'Something went wrong, invalid response.';
  }
}

export async function pollingTestWithTokenUntilDone(
  token: string,
  type: string,
  options: Options,
  pollInterval: number,
  attemptsCount: number,
  maxAttempts = Infinity,
): Promise<ResolveAndTestFactsResponse> {
  const payload = {
    method: 'GET',
    url: `${config.API}/test-dependencies/${token}`,
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
    qs: { ...assembleQueryString(options), type },
  };

  const response = await makeRequest<ResolveAndTestFactsResponse>(payload);

  if (pollingTestRequestHasFailed(response)) {
    throw response;
  }

  const taskCompleted = response.result && response.meta;
  if (taskCompleted) {
    return response;
  }

  attemptsCount++;
  checkPollingAttempts(maxAttempts)(attemptsCount);
  await sleep(pollInterval);
  return await pollingTestWithTokenUntilDone(
    token,
    type,
    options,
    pollInterval,
    attemptsCount,
    maxAttempts,
  );
}

function checkPollingAttempts(maxAttempts: number) {
  return (attemptsCount: number) => {
    if (attemptsCount > maxAttempts) {
      throw new Error('Exceeded Polling maxAttempts');
    }
  };
}

function pollingTestRequestHasFailed(
  response: ResolveAndTestFactsResponse,
): boolean {
  const { token, result, meta, status, error, code, message } = response;
  const hasError = !!error && !!code && !!message;
  const pollingContextIsMissing = !token && !result && !meta && !status;
  return !!pollingContextIsMissing || hasError;
}
