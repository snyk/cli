import chalk from 'chalk';
import envPaths from 'env-paths';
import * as pathLib from 'path';
import * as testLib from '../../../../../lib/iac/test/v2';
import { TestConfig } from '../../../../../lib/iac/test/v2';
import config from '../../../../../lib/config';
import { TestCommandResult } from '../../../types';

export async function test(): Promise<TestCommandResult> {
  const testConfig = prepareTestConfig();

  await testLib.test(testConfig);

  let response = '';
  response += chalk.bold.green('new flow for UPE integration - TBC...');
  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    '',
    '',
  );
}

function prepareTestConfig(): TestConfig {
  const systemCachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
  const iacCachePath = pathLib.join(systemCachePath, 'iac');

  return {
    cachedBundlePath: pathLib.join(iacCachePath, 'bundle.tar.gz'),
    userBundlePath: config.IAC_BUNDLE_PATH,
    cachedPolicyEnginePath: pathLib.join(iacCachePath, 'snyk-iac-test'),
    userPolicyEnginePath: config.IAC_POLICY_ENGINE_PATH,
  };
}
