import * as pathLib from 'path';
import * as testLib from '../../../../../lib/iac/test/v2';
import { TestConfig } from '../../../../../lib/iac/test/v2';
import config from '../../../../../lib/config';
import { TestCommandResult } from '../../../types';
import { buildSpinner, printHeader } from '../output';
import { spinnerMessage } from '../../../../../lib/formatters/iac-output/text';
import { buildOutput } from '../../../../../lib/iac/test/v2/output';
import { getIacOrgSettings } from '../local-execution/org-settings/get-iac-org-settings';
import { generateProjectAttributes } from '../../../monitor';
import { parseTags } from '../local-execution';
import { systemCachePath } from '../../../../../lib/iac/test/v2/scan';
import { getFlag } from '../index';
import { IaCTestFlags } from '../local-execution/types';
import { findAndLoadPolicy } from '../../../../../lib/policy';
import { assertIacV2Options } from './assert-iac-options';

export async function test(
  paths: string[],
  options: IaCTestFlags,
): Promise<TestCommandResult> {
  assertIacV2Options(options);
  const testConfig = await prepareTestConfig(paths, options);
  const { orgSettings } = testConfig;

  const testSpinner = buildSpinner(options);

  printHeader(options);

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
  options: IaCTestFlags,
): Promise<TestConfig> {
  const iacCachePath = pathLib.join(systemCachePath, 'iac');

  const org = (options.org as string) || config.org;
  const orgSettings = await getIacOrgSettings(org);
  const projectTags = parseTags(options);
  const targetName = getFlag(options, 'target-name');
  const remoteRepoUrl = getFlag(options, 'remote-repo-url');
  const depthDetection =
    parseInt(getFlag(options, 'depth-detection') as string) || undefined;
  const attributes = parseAttributes(options);
  const policy = await findAndLoadPolicy(process.cwd(), 'iac', options);
  const scan = options.scan ?? 'resource-changes';
  const varFile = options['var-file'];
  const cloudContext = getFlag(options, 'cloud-context');

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
    policy: policy?.toString(),
    scan,
    varFile,
    depthDetection,
    cloudContext,
  };
}

function parseAttributes(options: IaCTestFlags) {
  if (options.report) {
    return generateProjectAttributes(options);
  }
}
