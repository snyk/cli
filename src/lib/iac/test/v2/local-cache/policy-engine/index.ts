import * as createDebugLogger from 'debug';

import { TestConfig } from '../../types';
import { lookupLocalPolicyEngine } from './lookup-local';
import { downloadPolicyEngine } from './download';

const debugLogger = createDebugLogger('snyk-iac');

export async function initPolicyEngine(
  testConfig: TestConfig,
): Promise<string> {
  debugLogger('Looking for Policy Engine locally');
  let policyEnginePath = await lookupLocalPolicyEngine(testConfig);

  if (!policyEnginePath) {
    debugLogger(
      `Downloading the Policy Engine and saving it at ${testConfig.iacCachePath}`,
    );
    policyEnginePath = await downloadPolicyEngine(testConfig);
  }

  return policyEnginePath;
}
