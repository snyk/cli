import { initPolicyEngine } from './policy-engine';
import { createDirIfNotExists } from '../../../../file-utils';
import { CustomError } from '../../../../../errors';
import { FailedToInitLocalCacheError } from '../../../../../../cli/commands/test/iac/local-execution/local-cache';
import { TestOptions } from '../../types';
import { initRulesBundle } from './rules-bundle';

type InitLocalCacheOptions = Pick<
  TestOptions,
  'userPolicyEnginePath' | 'userRulesBundlePath'
>;

export async function initLocalCache(
  iacCachePath: string,
  options: InitLocalCacheOptions,
) {
  try {
    await createDirIfNotExists(iacCachePath);

    const policyEnginePath = await initPolicyEngine(
      iacCachePath,
      options.userPolicyEnginePath,
    );
    const rulesBundlePath = await initRulesBundle(
      iacCachePath,
      options.userRulesBundlePath,
    );

    return { policyEnginePath, rulesBundlePath };
  } catch (err) {
    throw err instanceof CustomError ? err : new FailedToInitLocalCacheError();
  }
}
