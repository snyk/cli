import * as createDebugLogger from 'debug';

import { lookupLocalPolicyEngine } from './lookup-local';
import { downloadPolicyEngine } from './download';

const debugLogger = createDebugLogger('snyk-iac');

export async function initPolicyEngine(
  iacCachePath: string,
  userPolicyEnginePath: string | undefined,
) {
  debugLogger('Looking for Policy Engine locally');
  let policyEnginePath = await lookupLocalPolicyEngine(
    iacCachePath,
    userPolicyEnginePath,
  );

  if (!policyEnginePath) {
    debugLogger(
      `Downloading the Policy Engine and saving it at ${iacCachePath}`,
    );
    policyEnginePath = await downloadPolicyEngine(iacCachePath);
  }

  return policyEnginePath;
}
