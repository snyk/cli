import * as createDebugLogger from 'debug';

import { TestConfig } from '../../../types';
import { downloadRulesBundle } from './download';
import { lookupLocalRulesBundle } from './lookup-local';

const debugLogger = createDebugLogger('snyk-iac');

export async function initRulesBundle(testConfig: TestConfig): Promise<string> {
  debugLogger('Looking for rules bundle locally');
  let rulesBundlePath = await lookupLocalRulesBundle(testConfig);

  if (!rulesBundlePath) {
    debugLogger(
      `Downloading the rules bundle and saving it at ${testConfig.iacCachePath}`,
    );
    rulesBundlePath = await downloadRulesBundle(testConfig);
  }

  return rulesBundlePath;
}
