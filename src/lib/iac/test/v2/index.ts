import { TestConfig } from './types';
import { setup } from './setup';
import { scan } from './scan';

export { TestConfig } from './types';

export async function test(testConfig: TestConfig) {
  const { testEnginePath, rulesBundlePath } = await setup(testConfig);

  // TODO use the results in a more meaningful way.
  scan(testConfig, testEnginePath, rulesBundlePath);

  return;
}
