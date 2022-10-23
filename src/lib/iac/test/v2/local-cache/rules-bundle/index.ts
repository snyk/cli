import config from '../../../../../config';
import * as createDebugLogger from 'debug';

const debugLog = createDebugLogger('snyk-iac');

export function getLocalRulesBundle(): string {
  // IAC_BUNDLE_PATH is a developer setting that is not useful to most users. It
  // is not a replacement for custom rules.
  if (!config.IAC_BUNDLE_PATH) {
    return '';
  }
  debugLog(`Located a local rules bundle at ${config.IAC_BUNDLE_PATH}`);
  return config.IAC_BUNDLE_PATH;
}
