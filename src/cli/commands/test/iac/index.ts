import { EOL } from 'os';
import { MissingArgError } from '../../../../lib/errors';
import { MethodArgs } from '../../../args';
import { TestCommandResult } from '../../../commands/types';
import {
  initalUserMessageOutput,
  shouldPrintIacInitialMessage,
} from '../../../../lib/formatters/iac-output';
import { getEcosystemForTest, testEcosystem } from '../../../../lib/ecosystems';
import { validateCredentials } from '../validate-credentials';
import { validateTestOptions } from '../validate-test-options';
import { setDefaultTestOptions } from '../set-default-test-options';
import { processCommandArgs } from '../../process-command-args';
import { hasFeatureFlag } from '../../../../lib/feature-flags';
import { getIacOrgSettings } from './local-execution/measurable-methods';
import config from '../../../../lib/config';
import { UnsupportedEntitlementError } from '../../../../lib/errors/unsupported-entitlement-error';
import { buildOutput } from './output';
import { initRulesAndScanPaths } from './scan';
import { assertIaCOptionsFlags } from './local-execution/assert-iac-options-flag';

// The hardcoded `isReportCommand` argument is temporary and will be removed together with the `snyk iac report` command deprecation
export default async function (
  isReportCommand: boolean,
  ...args: MethodArgs
): Promise<TestCommandResult> {
  assertIaCOptionsFlags(process.argv);

  const { options: originalOptions, paths } = processCommandArgs(...args);

  const options = setDefaultTestOptions(originalOptions);
  validateTestOptions(options);
  validateCredentials(options);

  // Handles no image arg provided to the container command until
  // a validation interface is implemented in the docker plugin.
  if (options.docker && paths.length === 0) {
    throw new MissingArgError();
  }

  const ecosystem = getEcosystemForTest(options);
  if (ecosystem) {
    try {
      const commandResult = await testEcosystem(ecosystem, paths, options);
      return commandResult;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(String(error));
      }
    }
  }

  const isNewIacOutputSupported = await hasFeatureFlag('iacCliOutput', options);

  if (shouldPrintIacInitialMessage(options, isNewIacOutputSupported)) {
    console.log(EOL + initalUserMessageOutput);
  }

  const orgPublicId = (options.org as string) ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);

  if (!iacOrgSettings.entitlements?.infrastructureAsCode) {
    throw new UnsupportedEntitlementError('infrastructureAsCode');
  }

  const {
    results,
    resultOptions,
    iacScanFailures,
    iacIgnoredIssuesCount,
    iacOutputMeta,
  } = await initRulesAndScanPaths(options, paths, orgPublicId, iacOrgSettings);

  return buildOutput(
    options,
    results,
    isNewIacOutputSupported,
    iacScanFailures,
    iacIgnoredIssuesCount,
    iacOutputMeta,
    resultOptions,
  );
}
