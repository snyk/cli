import { sleep } from '../common';
import { ScanResult } from '../ecosystems/types';
import {
  ResolutionMeta,
  ResolveAndMonitorFactsResponse,
  ResolveAndTestFactsResponse,
} from './types';
import { FailedToRunTestError } from '../errors';

export async function delayNextStep(
  attemptsCount: number,
  maxAttempts: number,
  pollInterval: number,
): Promise<void> {
  attemptsCount++;
  checkPollingAttempts(maxAttempts)(attemptsCount);
  await sleep(pollInterval);
}

function checkPollingAttempts(maxAttempts: number) {
  return (attemptsCount: number): void | Error => {
    if (attemptsCount > maxAttempts) {
      throw new Error('Exceeded Polling maxAttempts');
    }
  };
}

export function extractResolutionMetaFromScanResult({
  name,
  target,
  identity,
  policy,
  targetReference,
}: ScanResult): ResolutionMeta {
  return {
    name,
    target,
    identity,
    policy,
    targetReference,
  };
}

export function handleProcessingStatus(
  response: ResolveAndMonitorFactsResponse | ResolveAndTestFactsResponse,
): void {
  if (response?.status === 'CANCELLED' || response?.status === 'ERROR') {
    throw new FailedToRunTestError(
      'Failed to process the project. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output',
    );
  }
}
