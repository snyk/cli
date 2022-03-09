import { MethodArgs } from '../args';
import { processCommandArgs } from './process-command-args';
import * as legacyError from '../../lib/errors/legacy-errors';
import { driftctl, parseGenDriftIgnoreFlags } from '../../lib/iac/drift';
import { getIacOrgSettings } from './test/iac-local-execution/org-settings/get-iac-org-settings';
import { UnsupportedEntitlementCommandError } from './test/iac-local-execution/assert-iac-options-flag';
import config from '../../lib/config';

export default async (...args: MethodArgs): Promise<any> => {
  const { options } = processCommandArgs(...args);

  // Ensure that this gen-driftignore command can only be runned when using `snyk iac gen-driftignore`
  // Avoid `snyk gen-driftignore` direct usage
  if (options.iac != true) {
    return legacyError('gen-driftignore');
  }

  // Ensure that we are allowed to run that command
  // by checking the entitlement
  const orgPublicId = options.org ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);
  if (!iacOrgSettings.entitlements?.iacDrift) {
    throw new UnsupportedEntitlementCommandError('gen-driftignore', 'iacDrift');
  }

  try {
    const args = parseGenDriftIgnoreFlags(options);
    const ret = await driftctl(args);
    process.exit(ret);
  } catch (e) {
    const err = new Error('Error running `iac gen-driftignore` ' + e);
    return Promise.reject(err);
  }
};
