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
import { InvalidRemoteUrlError } from '../../../../lib/errors/invalid-remote-url-error';

export default async function(...args: MethodArgs): Promise<TestCommandResult> {
  const { options: originalOptions, paths } = processCommandArgs(...args);

  const options = setDefaultTestOptions(originalOptions);
  validateTestOptions(options);
  validateCredentials(options);
  const remoteRepoUrl = getRemoteRepoUrl(options);

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

function getRemoteRepoUrl(options: any) {
  const remoteRepoUrl = options['remote-repo-url'];

  if (!remoteRepoUrl) {
    return;
  }

  if (typeof remoteRepoUrl !== 'string') {
    throw new InvalidRemoteUrlError();
  }

  return remoteRepoUrl;
}
