import * as config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';

import { ResolveAndTestFactsResponse } from '../snyk-test/legacy';
import { assembleQueryString } from '../snyk-test/common';
import { getAuthHeader } from '../api-token';
import { ScanResult } from './types';

export async function requestPollingToken(
  options: Options,
  isAsync: boolean,
  scanResult: ScanResult,
): Promise<ResolveAndTestFactsResponse> {
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
  return await makeRequest<ResolveAndTestFactsResponse>(payload);
}

export async function pollingWithTokenUntilDone(
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

  if (response.result && response.meta) {
    return response;
  }

  if (pollingRequestHasFailed(response)) {
    throw new Error('polling request has failed.');
  }

  //TODO: (@snyk/tundra): move to backend
  checkPollingAttempts(maxAttempts)(attemptsCount);

  return await retryWithPollInterval(
    token,
    type,
    options,
    pollInterval,
    attemptsCount,
    maxAttempts,
  );
}

async function retryWithPollInterval(
  token: string,
  type: string,
  options: Options,
  pollInterval: number,
  attemptsCount: number,
  maxAttempts: number,
): Promise<ResolveAndTestFactsResponse> {
  return new Promise((resolve, reject) =>
    setTimeout(async () => {
      const res = await pollingWithTokenUntilDone(
        token,
        type,
        options,
        pollInterval,
        attemptsCount,
        maxAttempts,
      );

      if (pollingRequestHasFailed(res)) {
        return reject(res);
      }

      if (res.result && res.meta) {
        return resolve(res);
      }
    }, pollInterval),
  );
}

function checkPollingAttempts(maxAttempts: number) {
  return (attemptsCount: number) => {
    if (attemptsCount > maxAttempts) {
      throw new Error('Exceeded Polling maxAttempts');
    }
  };
}
function pollingRequestHasFailed(
  response: ResolveAndTestFactsResponse,
): boolean {
  const { token, result, meta, status, error, code, message } = response;
  const hasError = !!error && !!code && !!message;
  const pollingContextIsMissing = !token && !result && !meta && !status;

  return !!pollingContextIsMissing || hasError;
}
