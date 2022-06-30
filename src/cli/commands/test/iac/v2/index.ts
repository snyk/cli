import envPaths from 'env-paths';
import * as pathLib from 'path';
import * as testLib from '../../../../../lib/iac/test/v2';
import { TestConfig } from '../../../../../lib/iac/test/v2';
import config from '../../../../../lib/config';
import { TestCommandResult } from '../../../types';
import { buildSpinner, printHeader } from '../output';
import { spinnerMessage } from '../../../../../lib/formatters/iac-output';
import { buildOutput } from '../../../../../lib/iac/test/v2/output';
import { getIacOrgSettings } from '../local-execution/org-settings/get-iac-org-settings';
import { Options, TestOptions } from '../../../../../lib/types';

export async function test(
  paths: string[],
  options: Options & TestOptions,
): Promise<TestCommandResult> {
  const testConfig = await prepareTestConfig(paths, options);
  const { projectName, orgSettings } = testConfig;

  const testSpinner = buildSpinner({
    options,
    isNewIacOutputSupported: true,
  });

  printHeader({
    paths,
    options,
    isNewIacOutputSupported: true,
  });

  testSpinner?.start(spinnerMessage);

  const scanResult = await testLib.test(testConfig);

  return buildOutput({
    scanResult,
    testSpinner,
    projectName,
    orgSettings,
    options,
  });
}

async function prepareTestConfig(
  paths: string[],
  options: any,
): Promise<TestConfig> {
  const systemCachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
  const iacCachePath = pathLib.join(systemCachePath, 'iac');
  const projectName = pathLib.basename(process.cwd());

  const org = (options.org as string) || config.org;
  const orgSettings = await getIacOrgSettings(org);

  return {
    paths,
    iacCachePath,
    projectName,
    orgSettings,
    userRulesBundlePath: config.IAC_BUNDLE_PATH,
    userPolicyEnginePath: config.IAC_POLICY_ENGINE_PATH,
  };
}
