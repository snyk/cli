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
import { generateProjectAttributes } from '../../../monitor';
import { parseTags } from '../local-execution';
import { systemCachePath } from '../../../../../lib/iac/test/v2/scan';
import { getFlag } from '../index';

export async function test(
  paths: string[],
  options: Options & TestOptions,
): Promise<TestCommandResult> {
  const testConfig = await prepareTestConfig(paths, options);
  const { orgSettings } = testConfig;

  const testSpinner = buildSpinner({
    options,
    isNewIacOutputSupported: true,
  });

  printHeader({
    options,
    isNewIacOutputSupported: true,
  });

  testSpinner?.start(spinnerMessage);

  try {
    const scanResult = await testLib.test(testConfig);

    return buildOutput({
      scanResult,
      testSpinner,
      orgSettings,
      options,
    });
  } finally {
    testSpinner?.stop();
  }
}

async function prepareTestConfig(
  paths: string[],
  options: Options & TestOptions,
): Promise<TestConfig> {
  const iacCachePath = pathLib.join(systemCachePath, 'iac');

  const org = (options.org as string) || config.org;
  const orgSettings = await getIacOrgSettings(org);
  const projectTags = parseTags(options);
  const targetName = getFlag(options, 'target-name');
  const remoteRepoUrl = getFlag(options, 'remote-repo-url');

  const attributes = parseAttributes(options);

  return {
    paths,
    iacCachePath,
    orgSettings,
    userRulesBundlePath: config.IAC_BUNDLE_PATH,
    userPolicyEnginePath: config.IAC_POLICY_ENGINE_PATH,
    severityThreshold: options.severityThreshold,
    report: !!options.report,
    attributes,
    projectTags,
    targetReference: options['target-reference'],
    targetName,
    remoteRepoUrl,
  };
}

function parseAttributes(options: Options & TestOptions) {
  if (options.report) {
    return generateProjectAttributes(options);
  }
}
