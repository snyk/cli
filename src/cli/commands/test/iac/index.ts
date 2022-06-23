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

export default async function(...args: MethodArgs): Promise<TestCommandResult> {
  const { options: originalOptions, paths } = processCommandArgs(...args);

  const options = setDefaultTestOptions(originalOptions);
  validateTestOptions(options);
  validateCredentials(options);

  const orgPublicId = (options.org as string) ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);

  if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
    throw new UnsupportedEntitlementError('infrastructureAsCode');
  }

  const buildOciRegistry = () => buildDefaultOciRegistry(iacOrgSettings);

  const isNewIacOutputSupported =
    config.IAC_OUTPUT_V2 ||
    (await hasFeatureFlag('iacCliOutputRelease', options));

  const testSpinner = buildSpinner({
    options,
    isNewIacOutputSupported,
  });

  printHeader({
    paths,
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
  );

  return buildOutput({
    results,
    options,
    isNewIacOutputSupported,
    iacOutputMeta,
    resultOptions,
    iacScanFailures,
    iacIgnoredIssuesCount,
    testSpinner,
  });
}
