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
  'snyk-iac-test_0.1.0_Linux_x86_64':
    '0b0d846cd74bf42676f79875ab30f20dc08529aedb94f2f6dd31a67c302b78e4',
  'snyk-iac-test_0.1.0_Darwin_x86_64':
    '896960a09b6adf699185f443428cda25ccb30123440bc8735e1a05df1e9cbc12',
  'snyk-iac-test_0.1.0_Windows_x86_64.exe':
    'a0b0b5781218f42d121cd1c6bca2d5ea27fbe76b1e9817e37745586c276cabda',
  'snyk-iac-test_0.1.0_Linux_arm64':
    'b0c0bd9a06cc3d556b526b868e5a4ac4c5a3938899c4e312607f6828626debe9',
  'snyk-iac-test_0.1.0_Darwin_arm64':
    'cf7a327378983810ea043774a333bdd724e3866a815555d59ec5cd8aa25ea5ec',
  'snyk-iac-test_0.1.0_Windows_arm64.exe':
    'd88b24c611c8d37c2df9382e6e1b39933b926ee2ed438f1fdb69c51da5086fc5',
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
