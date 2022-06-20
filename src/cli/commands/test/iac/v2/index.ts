import chalk from 'chalk';
import envPaths from 'env-paths';
import * as pathLib from 'path';
import * as testLib from '../../../../../lib/iac/test/v2';
import { TestConfig } from '../../../../../lib/iac/test/v2';
import config from '../../../../../lib/config';
import { TestCommandResult } from '../../../types';
import { MethodArgs } from '../../../../args';
import { processCommandArgs } from '../../../process-command-args';

export async function test(...args: MethodArgs): Promise<TestCommandResult> {
  const { paths } = processCommandArgs(...args);
  const testConfig = prepareTestConfig(paths);

  await testLib.test(testConfig);

  let response = '';
  response += chalk.bold.green('new flow for UPE integration - TBC...');
  return TestCommandResult.createHumanReadableTestCommandResult(
    response,
    '',
    '',
  );
}

function prepareTestConfig(paths: string[]): TestConfig {
  const systemCachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
  const iacCachePath = pathLib.join(systemCachePath, 'iac');

  return {
    paths,
    iacCachePath,
    userBundlePath: config.IAC_BUNDLE_PATH,
    userPolicyEnginePath: config.IAC_POLICY_ENGINE_PATH,
  };
}
