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
    `Downloaded and cached Policy Engine successfully in ${downloadDurationSeconds} seconds`,
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
  'snyk-iac-test_0.3.0_Darwin_x86_64':
    '02c128be0fa66aac7bc0de57f8c3c35e84ace8dd8a4b5ecb6c28eed7c27b3c7d',
  'snyk-iac-test_0.3.0_Windows_arm64.exe':
    '62038ace2d5731721ea28ff4fda81da6602838690ff1ecbc577fd3cfc6fc8cf1',
  'snyk-iac-test_0.3.0_Linux_x86_64':
    '73882e94b778f5b7e6bb19b9397ffb3d460d705eef8f1ca59144a37271042804',
  'snyk-iac-test_0.3.0_Windows_x86_64.exe':
    '815d4383701ea22e04f29681de9b3c6196f6d5403890775af154ac7b38eb190d',
  'snyk-iac-test_0.3.0_Darwin_arm64':
    '9e2350e093167fd001e38168464f1fa3768b999d7777c02d4ddc3afe534e1391',
  'snyk-iac-test_0.3.0_Linux_arm64':
    '9e366df185f18a3cd93e92ecc84df68f2d1bddbb61f3c2af0d09911c5161e317',
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
