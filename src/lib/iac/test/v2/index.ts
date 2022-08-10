import { TestConfig } from './types';
import { setup } from './setup';
import { scan } from './scan';
import { TestOutput } from '../../../../lib/iac/test/v2/scan/results';

export { TestConfig } from './types';

export async function test(testConfig: TestConfig): Promise<TestOutput> {
  const { policyEnginePath, rulesBundlePath } = await setup(testConfig);

  return scan(testConfig, policyEnginePath, rulesBundlePath);
}
