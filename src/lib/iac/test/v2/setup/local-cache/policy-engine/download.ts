import * as pathLib from 'path';
import * as crypto from 'crypto';
import * as createDebugLogger from 'debug';

import { getErrorStringCode } from '../../../../../../../cli/commands/test/iac/local-execution/error-utils';
import { IaCErrorCodes } from '../../../../../../../cli/commands/test/iac/local-execution/types';
import { CustomError } from '../../../../../../errors';
import { TimerMetricInstance } from '../../../../../../metrics';
import { TestConfig } from '../../../types';
import { fetchCacheResource } from '../utils';
import { policyEngineFileName, policyEngineReleaseVersion } from './constants';
import { saveFile } from '../../../../../file-utils';

const debugLog = createDebugLogger('snyk-iac');

export async function downloadPolicyEngine(
  testConfig: TestConfig,
): Promise<string> {
  let downloadDurationSeconds = 0;

  const timer = new TimerMetricInstance('iac_policy_engine_download');
  timer.start();

  const dataBuffer = await fetch();

  assertValidChecksum(dataBuffer);

  const cachedPolicyEnginePath = await cache(
    dataBuffer,
    testConfig.iacCachePath,
  );

  timer.stop();
  downloadDurationSeconds = Math.round((timer.getValue() as number) / 1000);

  debugLog(
    `Downladed Policy Engine successfully in ${downloadDurationSeconds} seconds`,
  );

  return cachedPolicyEnginePath;
}

async function fetch(): Promise<Buffer> {
  debugLog(`Fetching Policy Engine executable from ${policyEngineUrl}`);

  let policyEngineDataBuffer: Buffer;
  try {
    policyEngineDataBuffer = await fetchCacheResource(policyEngineUrl);
  } catch (err) {
    throw new FailedToDownloadPolicyEngineError();
  }
  debugLog('Policy Engine executable was fetched successfully');

  return policyEngineDataBuffer;
}

export const policyEngineUrl = `https://static.snyk.io/cli/iac/test/v${policyEngineReleaseVersion}/${policyEngineFileName}`;

export class FailedToDownloadPolicyEngineError extends CustomError {
  constructor() {
    super(`Failed to download cache resource from ${policyEngineUrl}`);
    this.code = IaCErrorCodes.FailedToDownloadPolicyEngineError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      `Could not fetch cache resource from: ${policyEngineUrl}` +
      '\nEnsure valid network connection.';
  }
}

function assertValidChecksum(dataBuffer: Buffer): void {
  const computedChecksum = crypto
    .createHash('sha256')
    .update(dataBuffer)
    .digest('hex');

  if (computedChecksum !== policyEngineChecksum) {
    throw new FailedToDownloadPolicyEngineError();
  }

  debugLog('Fetched Policy Engine executable has valid checksum');
}

export const policyEngineChecksum = {
  'snyk-iac-test_0.2.0_Linux_arm64':
    '24f77f8a190523fb7417f24d56cb251abdc670da0a1e65c063861027e1a3e0be',
  'snyk-iac-test_0.2.0_Linux_x86_64':
    '25b65f1eca925ae0e866d1a5a404dbf756b531402d84bf3df2a9415579235004',
  'snyk-iac-test_0.2.0_Darwin_arm64':
    '6a8ae91f19124d865d40beafd9764e51c746748c0d851e456e8ff0a56982dca7',
  'snyk-iac-test_0.2.0_Windows_arm64.exe':
    'b862f2d9840d112d388a69238421d01e8a229e88401d892a4c865d7420773399',
  'snyk-iac-test_0.2.0_Windows_x86_64.exe':
    'e28e9bf0617e60f4259a1ede5aa9b2a820ba070675bb00a0c5925b35a2642ac0',
  'snyk-iac-test_0.2.0_Darwin_x86_64':
    'f9fedfc563330ed29667226110cc6652ead5e2afa35da63d19506f09c4956716',
}[policyEngineFileName]!;

async function cache(
  dataBuffer: Buffer,
  iacCachePath: string,
): Promise<string> {
  const savePath = pathLib.join(iacCachePath, policyEngineFileName);

  debugLog(`Caching Policy Engine executable to ${savePath}`);

  try {
    await saveFile(dataBuffer, savePath);
  } catch (err) {
    throw new FailedToCachePolicyEngineError(savePath);
  }

  debugLog(`Policy Engine executable was successfully cached`);

  return savePath;
}

export class FailedToCachePolicyEngineError extends CustomError {
  constructor(savePath: string) {
    super(`Failed to cache Policy Engine executable to ${savePath}`);
    this.code = IaCErrorCodes.FailedToCachePolicyEngineError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      `Could not write the downloaded cache resource to: ${savePath}` +
      '\nEnsure the cache directory is writable.';
  }
}
