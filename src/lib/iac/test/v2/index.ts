import { TestConfig } from './types';
import { scan } from './scan';
import { TestOutput } from './scan/results';
import { initLocalCache } from './local-cache';

export { TestConfig } from './types';

export async function test(testConfig: TestConfig): Promise<TestOutput> {
  const { policyEnginePath, rulesBundlePath } = await initLocalCache(
    testConfig,
  );

  return scan(testConfig, policyEnginePath, rulesBundlePath);
}
