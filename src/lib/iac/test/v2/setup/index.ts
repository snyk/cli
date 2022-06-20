import { TestConfig } from '../types';
import { initRules } from './rules';
import { initPolicyEngine } from './policy-engine';

export async function setup(testConfig: TestConfig) {
  const policyEnginePath = await initPolicyEngine(testConfig);
  const rulesBundlePath = await initRules(testConfig);
  return { policyEnginePath, rulesBundlePath };
}
