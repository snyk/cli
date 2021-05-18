import { assertIaCOptionsFlags } from './iac-local-execution/assert-iac-options-flag';
import { IaCTestOptions, TestReturnValue } from './iac-local-execution/types';
import { localTest } from './iac-local-execution/measurable-methods';
import { test as legacyTest } from '../../../lib';
import { getIacOrgSettings } from './iac-local-execution/org-settings/get-iac-org-settings';
import { isFeatureFlagSupportedForOrg } from '../../../lib/feature-flags';
import config = require('../../../lib/config');
const camelCase = require('lodash.camelcase');

/**
 * Shim around the new local execution test path and the legacy remote
 * test flow. We also locally deal with the way the legacy test flow exposes
 * the scanned files via the `options.iacDirFiles` object here so that
 * in the new flow we do not mutate the options object.
 */
export async function test(
  pathToScan: string,
  options: IaCTestOptions,
): Promise<TestReturnValue> {
  // Ensure that all flags are correct. We do this to ensure that the
  // caller doesn't accidentally mistype --experimental and send their
  // configuration files to our backend by accident.
  assertIaCOptionsFlags(process.argv);
  const iacOrgSettings = await getIacOrgSettings(options.org || config.org);
  const shouldOptOutFromLocalExec = await isFeatureFlagSupportedForOrg(
    camelCase('opt-out-from-local-exec-iac'),
    iacOrgSettings.meta.org,
  );
  if (shouldOptOutFromLocalExec.ok || options.legacy) {
    // this path allows users to opt-out from the local IaC scan which is GA and continue using the remote-processing legacy flow.
    const results = await legacyTest(pathToScan, options);
    return {
      failures: options.iacDirFiles?.filter((file) => !!file.failureReason),
      results,
    };
  }
  return localTest(pathToScan, options);
}
