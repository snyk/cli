import { TestConfig } from './types';
import { scan } from './scan';
import { TestOutput } from './scan/results';
import { initLocalCache } from './local-cache';
import { addIacAnalytics } from './analytics';

export { TestConfig } from './types';

export async function test(testConfig: TestConfig): Promise<TestOutput> {
  const { policyEnginePath, rulesBundlePath } = await initLocalCache(
    testConfig,
  );

  const testOutput = await scan(testConfig, policyEnginePath, rulesBundlePath);

  addIacAnalytics(testConfig, testOutput);

  return testOutput;
}
