import { TestConfig } from '../types';
import { overrideDevelopmentPaths } from './rules-bundle';
import { initPolicyEngine } from './policy-engine';
import { createDirIfNotExists } from '../../../file-utils';
import { CustomError } from '../../../../errors';
import { FailedToInitLocalCacheError } from '../../../../../cli/commands/test/iac/local-execution/local-cache';

interface LocalCache {
  policyEnginePath: string;
  rulesBundlePath: string;
  rulesClientURL: string;
}

export async function initLocalCache(
  testConfig: TestConfig,
): Promise<LocalCache> {
  try {
    await createDirIfNotExists(testConfig.iacCachePath);

    const policyEnginePath = await initPolicyEngine(testConfig);
    const { rulesBundlePath, rulesClientURL } = overrideDevelopmentPaths();

    return { policyEnginePath, rulesBundlePath, rulesClientURL };
  } catch (err) {
    throw err instanceof CustomError ? err : new FailedToInitLocalCacheError();
  }
}
