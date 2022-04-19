import { sleep } from '../common';
import { ScanResult } from '../ecosystems/types';
import { ResolutionMeta } from './types';

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
