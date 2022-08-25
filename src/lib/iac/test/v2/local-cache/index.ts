import { TestConfig } from '../types';
import { initRulesBundle } from './rules-bundle';
import { initPolicyEngine } from './policy-engine';
import { createDirIfNotExists } from '../../../file-utils';
import { CustomError } from '../../../../errors';
import { FailedToInitLocalCacheError } from '../../../../../cli/commands/test/iac/local-execution/local-cache';

interface LocalCache {
  policyEnginePath: string;
  rulesBundlePath: string;
}

export async function initLocalCache(
  testConfig: TestConfig,
): Promise<LocalCache> {
  try {
    await createDirIfNotExists(testConfig.iacCachePath);

    const policyEnginePath = await initPolicyEngine(testConfig);
    const rulesBundlePath = await initRulesBundle(testConfig);

    return { policyEnginePath, rulesBundlePath };
  } catch (err) {
    throw err instanceof CustomError ? err : new FailedToInitLocalCacheError();
  }
}
