import config from '../../../../../config';
import * as createDebugLogger from 'debug';

const debugLog = createDebugLogger('snyk-iac');

export function overrideDevelopmentPaths(): {
  rulesBundlePath: string;
  rulesClientURL: string;
} {
  // IAC_BUNDLE_PATH and IAC_RULES_CLIENT_URL are developer settings that are not useful to most users.
  // They are not a replacement for custom rules.
  let rulesBundlePath = '',
    rulesClientURL = '';
  if (config.IAC_BUNDLE_PATH) {
    debugLog(`Located a local rules bundle at ${config.IAC_BUNDLE_PATH}`);
    rulesBundlePath = config.IAC_BUNDLE_PATH;
  }
  if (config.IAC_RULES_CLIENT_URL) {
    debugLog(
      `rulesClientURL is now overridden with ${config.IAC_RULES_CLIENT_URL}`,
    );
    rulesClientURL = config.IAC_RULES_CLIENT_URL;
  }
  return {
    rulesBundlePath,
    rulesClientURL,
  };
}
