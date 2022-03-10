import { MethodArgs } from '../args';
import { processCommandArgs } from './process-command-args';
import * as legacyError from '../../lib/errors/legacy-errors';
import { DCTL_EXIT_CODES, runDriftCTL } from '../../lib/iac/drift';
import { getIacOrgSettings } from './test/iac-local-execution/org-settings/get-iac-org-settings';
import { UnsupportedEntitlementCommandError } from './test/iac-local-execution/assert-iac-options-flag';
import config from '../../lib/config';

export default async (...args: MethodArgs): Promise<any> => {
  const { options } = processCommandArgs(...args);

  // Ensure that this describe command can only be runned when using `snyk iac describe`
  // Avoid `snyk describe` direct usage
  if (options.iac != true) {
    return legacyError('describe');
  }

  // Ensure that we are allowed to run that command
  // by checking the entitlement
  const orgPublicId = options.org ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);
  if (!iacOrgSettings.entitlements?.iacDrift) {
    throw new UnsupportedEntitlementCommandError('drift', 'iacDrift');
  }

  try {
    const describe = await runDriftCTL({
      options: { kind: 'describe', ...options },
    });
    if (describe.code === DCTL_EXIT_CODES.EXIT_ERROR) {
      process.exit(describe.code);
    }
    // TODO handle drift related analytics here
    //const driftctlAnalysis = parseDriftAnalysisResults(describe.stdout)
    const fmtResult = await runDriftCTL({
      options: { kind: 'fmt', ...options },
      input: describe.stdout,
    });
    process.stdout.write(fmtResult.stdout);
    process.exit(describe.code);
  } catch (e) {
    const err = new Error('Error running `iac describe` ' + e);
    return Promise.reject(err);
  }
};
