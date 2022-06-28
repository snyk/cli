import * as createDebugLogger from 'debug';

import { TestConfig } from '../../../types';
import { lookupLocalTestEngine } from './lookup-local';
import { downloadTestEngine } from './download';

const debugLogger = createDebugLogger('snyk-iac');

export async function initTestEngine(testConfig: TestConfig) {
  debugLogger('Looking for Test Engine locally');
  let testEnginePath = await lookupLocalTestEngine(testConfig);

  if (!testEnginePath) {
    debugLogger(
      `Downloading the Test Engine and saving it at ${testConfig.iacCachePath}`,
    );
    testEnginePath = await downloadTestEngine(testConfig);
  }

  return testEnginePath;
}
