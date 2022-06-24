import * as createDebugLogger from 'debug';
import * as path from 'path';

import { getErrorStringCode } from '../../../../../../../cli/commands/test/iac/local-execution/error-utils';
import { IaCErrorCodes } from '../../../../../../../cli/commands/test/iac/local-execution/types';
import { CustomError } from '../../../../../../errors';
import { TimerMetricInstance } from '../../../../../../metrics';
import { saveFile } from '../../../../../file-utils';
import { fetchCacheResource } from '../utils';
import { rulesBundleName } from './constants';

const debugLog = createDebugLogger('snyk-iac');

export async function downloadRulesBundle(
  iacCachePath: string,
): Promise<string> {
  let downloadDurationSeconds = 0;

  const timer = new TimerMetricInstance('iac_rules_bundle_download');
  timer.start();

  const dataBuffer = await fetch();

  const cachedRulesBundlePath = await cache(dataBuffer, iacCachePath);

  timer.stop();
  downloadDurationSeconds = Math.round((timer.getValue() as number) / 1000);

  debugLog(
    `Downloaded and cached rules bundle successfully in ${downloadDurationSeconds} seconds`,
  );

  return cachedRulesBundlePath;
}

async function fetch(): Promise<Buffer> {
  debugLog(`Fetching rules bundle from ${rulesBundleUrl}`);

  let rulesBundleDataBuffer: Buffer;
  try {
    rulesBundleDataBuffer = await fetchCacheResource(rulesBundleUrl);
  } catch (err) {
    throw new FailedToDownloadRulesBundleError();
  }
  debugLog('Rules bundle was fetched successfully');

  return rulesBundleDataBuffer;
}

export const rulesBundleUrl =
  'https://static.snyk.io/cli/wasm/bundle-experimental.tar.gz';

export class FailedToDownloadRulesBundleError extends CustomError {
  constructor() {
    super(`Failed to download cache resource from ${rulesBundleUrl}`);
    this.code = IaCErrorCodes.FailedToDownloadRulesBundleError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      `Could not fetch cache resource from: ${rulesBundleUrl}` +
      '\nEnsure valid network connection.';
  }
}

async function cache(
  dataBuffer: Buffer,
  iacCachePath: string,
): Promise<string> {
  const savePath = path.join(iacCachePath, rulesBundleName);

  debugLog(`Caching rules bundle to ${savePath}`);

  try {
    await saveFile(dataBuffer, savePath);
  } catch (err) {
    throw new FailedToCacheRulesBundleError(savePath);
  }

  debugLog(`Rules bundle was successfully cached`);

  return savePath;
}

export class FailedToCacheRulesBundleError extends CustomError {
  constructor(savePath: string) {
    super(`Failed to cache rules bundle to ${savePath}`);
    this.code = IaCErrorCodes.FailedToCacheRulesBundleError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      `Could not write the downloaded cache resource to: ${savePath}` +
      '\nEnsure the cache directory is writable.';
  }
}
