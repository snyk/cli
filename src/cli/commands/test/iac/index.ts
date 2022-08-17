import { MethodArgs } from '../../../args';
import { TestCommandResult } from '../../types';

import { validateCredentials } from '../validate-credentials';
import { validateTestOptions } from '../validate-test-options';
import { setDefaultTestOptions } from '../set-default-test-options';
import { processCommandArgs } from '../../process-command-args';

import { hasFeatureFlag } from '../../../../lib/feature-flags';
import { buildDefaultOciRegistry } from './local-execution/rules/rules';
import { getIacOrgSettings } from './local-execution/measurable-methods';
import config from '../../../../lib/config';
import { UnsupportedEntitlementError } from '../../../../lib/errors/unsupported-entitlement-error';
import { scan } from './scan';
import { buildOutput, buildSpinner, printHeader } from './output';
import { Options, TestOptions } from '../../../../lib/types';
import { InvalidArgumentError } from './local-execution/assert-iac-options-flag';

export default async function(...args: MethodArgs): Promise<TestCommandResult> {
  const { options: originalOptions, paths } = processCommandArgs(...args);

  const options = setDefaultTestOptions(originalOptions);
  validateTestOptions(options);
  validateCredentials(options);
  const remoteRepoUrl = getFlag(options, 'remote-repo-url');
  const targetName = getFlag(options, 'target-name');

  const orgPublicId = (options.org as string) ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);

  if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
    throw new UnsupportedEntitlementError('infrastructureAsCode');
  }

  const buildOciRegistry = () => buildDefaultOciRegistry(iacOrgSettings);

  const isNewIacOutputSupported = Boolean(
    config.IAC_OUTPUT_V2 ||
      (await hasFeatureFlag('iacCliOutputRelease', options)),
  );

  const isIacShareCliResultsCustomRulesSupported = Boolean(
    await hasFeatureFlag('iacShareCliResultsCustomRules', options),
  );

  const isIacCustomRulesEntitlementEnabled = Boolean(
    iacOrgSettings.entitlements?.iacCustomRulesEntitlement,
  );

  const testSpinner = buildSpinner({
    options,
    isNewIacOutputSupported,
  });

  const projectRoot = process.cwd();

  printHeader({
    options,
    isNewIacOutputSupported,
  });

  const {
    iacOutputMeta,
    iacScanFailures,
    iacIgnoredIssuesCount,
    results,
    resultOptions,
  } = await scan(
    iacOrgSettings,
    options,
    testSpinner,
    paths,
    orgPublicId,
    buildOciRegistry,
    projectRoot,
    remoteRepoUrl,
    targetName,
  );

  return buildOutput({
    results,
    options,
    isNewIacOutputSupported,
    isIacShareCliResultsCustomRulesSupported,
    isIacCustomRulesEntitlementEnabled,
    iacOutputMeta,
    resultOptions,
    iacScanFailures,
    iacIgnoredIssuesCount,
    testSpinner,
  });
}

export function getFlag(
  options: Options & TestOptions,
  flag: string,
): string | undefined {
  const flagValue = options[flag];

  if (!flagValue) {
    return;
  }
  // if the user does not provide a value, it will be of boolean type
  if (typeof flagValue !== 'string') {
    throw new InvalidArgumentError(flag);
  }

  return flagValue;
}
