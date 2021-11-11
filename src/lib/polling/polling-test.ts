import config from '../config';
import { isCI } from '../is-ci';
import { makeRequest } from '../request/promise';
import { Options } from '../types';

import { assembleQueryString } from '../snyk-test/common';
import { getAuthHeader } from '../api-token';
import { ScanResult } from '../ecosystems/types';

import { ResolveAndTestFactsResponse } from './types';
import { delayNextStep } from './common';
import { TestDependenciesResult } from '../snyk-test/legacy';

export async function requestTestPollingToken(
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

export async function pollingTestWithTokenUntilDone(
  token: string,
  type: string,
  options: Options,
  pollInterval: number,
  attemptsCount: number,
  maxAttempts = Infinity,
): Promise<TestDependenciesResult> {
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

  if (response.result) {
    const {
      issues,
      issuesData,
      depGraphData,
      depsFilePaths,
      fileSignaturesDetails,
    } = response.result;
    return {
      issues,
      issuesData,
      depGraphData,
      depsFilePaths,
      fileSignaturesDetails,
    };
  }

  await delayNextStep(attemptsCount, maxAttempts, pollInterval);
  return await pollingTestWithTokenUntilDone(
    token,
    type,
    options,
    pollInterval,
    attemptsCount,
    maxAttempts,
  );
}
