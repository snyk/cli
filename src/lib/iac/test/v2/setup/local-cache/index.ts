import { TestConfig } from '../../types';
import { initRules } from './rules';
import { initPolicyEngine } from './policy-engine';
import { createDirIfNotExists } from '../../../../file-utils';
import { CustomError } from '../../../../../errors';
import { FailedToInitLocalCacheError } from '../../../../../../cli/commands/test/iac/local-execution/local-cache';

export async function initLocalCache(testConfig: TestConfig) {
  try {
    await createDirIfNotExists(testConfig.iacCachePath);

    const policyEnginePath = await initPolicyEngine(testConfig);
    const rulesBundlePath = await initRules(testConfig);

    return { policyEnginePath, rulesBundlePath };
  } catch (err) {
    throw err instanceof CustomError ? err : new FailedToInitLocalCacheError();
  }
}
