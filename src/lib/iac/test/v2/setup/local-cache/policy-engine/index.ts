import { TestConfig } from '../../../types';
import { InvalidUserPolicyEnginePathError, lookupLocal } from './lookup-local';

export async function initPolicyEngine(testConfig: TestConfig) {
  const localPolicyEnginePath = await lookupLocal(testConfig);
  if (localPolicyEnginePath) {
    return localPolicyEnginePath;
  }

  // TODO: Download Policy Engine executable

  throw new InvalidUserPolicyEnginePathError('', 'policy engine not found');
}
