import { TestConfig } from './types';
import { setup } from './setup';

export { TestConfig } from './types';

export async function test(testConfig: TestConfig) {
  await setup(testConfig);

  // TODO: Add the rest of the test steps

  return;
}
