import { TestConfig } from './types';
import { setup } from './setup';
import { scan } from './scan';
import { SnykIacTestOutput } from '../../../../cli/commands/test/iac/v2/types';

export { TestConfig } from './types';

export async function test(testConfig: TestConfig): Promise<SnykIacTestOutput> {
  const { policyEnginePath, rulesBundlePath } = await setup(testConfig);

  return scan(testConfig, policyEnginePath, rulesBundlePath);
}
