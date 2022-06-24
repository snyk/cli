import { TestConfig } from './types';
import { setup } from './setup';
import { scan } from './scan';

export { TestConfig } from './types';

export async function test(testPaths: string[], testConfig: TestConfig) {
  const { policyEnginePath, rulesBundlePath } = await setup(testConfig);

  // TODO use the results in a more meaningful way.
  scan(testPaths, {
    policyEnginePath,
    rulesBundlePath,
  });

  return;
}
