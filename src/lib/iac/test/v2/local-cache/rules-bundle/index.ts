import * as createDebugLogger from 'debug';

import { TestConfig } from '../../types';
import { downloadRulesBundle } from './download';

const debugLogger = createDebugLogger('snyk-iac');

export async function initRulesBundle(testConfig: TestConfig): Promise<string> {
  // We are currently using the legacy rules bundle and we need to re-download it each time to use the latest one available.
  // debugLogger('Looking for rules bundle locally');
  // let rulesBundlePath = await lookupLocalRulesBundle(testConfig);

  debugLogger(
    `Downloading the rules bundle and saving it at ${testConfig.iacCachePath}`,
  );
  return await downloadRulesBundle(testConfig);
}
