import * as pathLib from 'path';
import * as testLib from '../../../../../lib/iac/test/v2';
import { TestConfig } from '../../../../../lib/iac/test/v2';
import config from '../../../../../lib/config';
import { TestCommandResult } from '../../../types';
import { buildSpinner, printHeader } from '../output';
import { spinnerMessage } from '../../../../../lib/formatters/iac-output/text';
import { buildOutput } from '../../../../../lib/iac/test/v2/output';
import { systemCachePath } from '../../../../../lib/iac/test/v2/scan';
import { getFlag } from '../index';
import { IaCTestFlags } from '../local-execution/types';
import { findAndLoadPolicy } from '../../../../../lib/policy';
import { assertIacV2Options } from './assert-iac-options';

export async function test(
  paths: string[],
  options: IaCTestFlags,
  iacNewEngine?: boolean,
): Promise<TestCommandResult> {
  assertIacV2Options(options);
  const testConfig = await prepareTestConfig(paths, options, iacNewEngine);

  const testSpinner = buildSpinner(options);

  printHeader(options);

  testSpinner?.start(spinnerMessage);

  try {
    const scanResult = await testLib.test(testConfig);

    return buildOutput({
      scanResult,
      testSpinner,
      options,
    });
  } finally {
    testSpinner?.stop();
  }
}

async function prepareTestConfig(
  paths: string[],
  options: IaCTestFlags,
  iacNewEngine?: boolean,
): Promise<TestConfig> {
  const iacCachePath = pathLib.join(systemCachePath, 'iac');

  // When running in a case-insensitive file system (for example, in macOS),
  // Node consider the current working directory to be the `realpath`, while Go
  // consider it to be the `pwd`. To prevent confusion when passing the path of
  // the current working directory as an input path, let's make every path
  // relative and let snyk-iac-test figure them out according to what it
  // considers the current working directory to be.

  const relativePaths = paths.map((p) => pathLib.relative(process.cwd(), p));

  const org = (options.org as string) || config.org;
  const targetName = getFlag(options, 'target-name');
  const remoteRepoUrl = getFlag(options, 'remote-repo-url');
  const depthDetection =
    parseInt(getFlag(options, 'depth-detection') as string) || undefined;
  const policy = await findAndLoadPolicy(process.cwd(), 'iac', options);
  const scan = options.scan ?? 'resource-changes';
  const varFile = options['var-file'];
  const snykCloudEnvironment = getFlag(options, 'snyk-cloud-environment');
  const insecure = options.insecure;
  const customRules = options['custom-rules'];
  const experimental = options.experimental;

  return {
    paths: relativePaths,
    iacCachePath,
    userRulesBundlePath: config.IAC_BUNDLE_PATH,
    userPolicyEnginePath: config.IAC_POLICY_ENGINE_PATH,
    userRulesClientURL: config.IAC_RULES_CLIENT_URL,
    severityThreshold: options.severityThreshold,
    report: !!options.report,
    targetReference: options['target-reference'],
    targetName,
    remoteRepoUrl,
    policy: policy?.toString(),
    scan,
    varFile,
    depthDetection,
    snykCloudEnvironment,
    insecure,
    org,
    customRules,
    experimental,
    iacNewEngine,
  };
}
