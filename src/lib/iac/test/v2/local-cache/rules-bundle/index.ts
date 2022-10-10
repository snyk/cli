import { TestConfig } from '../../types';
import { downloadRulesBundle } from './download';

export async function initRulesBundle(testConfig: TestConfig): Promise<string> {
  // We are currently using the legacy rules bundle and we need to re-download it each time to use the latest one available.
  // debugLogger('Looking for rules bundle locally');
  // let rulesBundlePath = await lookupLocalRulesBundle(testConfig);

  return await downloadRulesBundle(testConfig);
}
