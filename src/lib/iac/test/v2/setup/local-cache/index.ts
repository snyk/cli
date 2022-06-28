import { TestConfig } from '../../types';
import { initRulesBundle } from './rules-bundle';
import { initTestEngine } from './test-engine';
import { createDirIfNotExists } from '../../../../file-utils';
import { CustomError } from '../../../../../errors';
import { FailedToInitLocalCacheError } from '../../../../../../cli/commands/test/iac/local-execution/local-cache';

export async function initLocalCache(testConfig: TestConfig) {
  try {
    await createDirIfNotExists(testConfig.iacCachePath);

    const testEnginePath = await initTestEngine(testConfig);
    const rulesBundlePath = await initRulesBundle(testConfig);

    return { testEnginePath, rulesBundlePath };
  } catch (err) {
    throw err instanceof CustomError ? err : new FailedToInitLocalCacheError();
  }
}
