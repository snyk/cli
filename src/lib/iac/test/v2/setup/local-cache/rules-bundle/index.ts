import * as createDebugLogger from 'debug';

import { downloadRulesBundle } from './download';
import { lookupLocalRulesBundle } from './lookup-local';

const debugLogger = createDebugLogger('snyk-iac');

export async function initRulesBundle(
  iacCachePath: string,
  userRulesBundlePath: string | undefined,
): Promise<string> {
  debugLogger('Looking for rules bundle locally');
  let rulesBundlePath = await lookupLocalRulesBundle(
    iacCachePath,
    userRulesBundlePath,
  );

  if (!rulesBundlePath) {
    debugLogger(
      `Downloading the rules bundle and saving it at ${iacCachePath}`,
    );
    rulesBundlePath = await downloadRulesBundle(iacCachePath);
  }

  return rulesBundlePath;
}
