import { TestConfig } from '../types';
import { initRules } from './rules';
import { initPolicyEngine } from './policy-engine';

export async function setup(testConfig: TestConfig) {
  await initPolicyEngine(testConfig);
  await initRules(testConfig);
}
