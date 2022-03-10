import { MethodArgs } from '../args';
import { processCommandArgs } from './process-command-args';
import * as legacyError from '../../lib/errors/legacy-errors';
import {
  DCTL_EXIT_CODES,
  runDriftCTL,
  driftignoreFromPolicy,
  parseDriftAnalysisResults,
} from '../../lib/iac/drift';
import { getIacOrgSettings } from './test/iac-local-execution/org-settings/get-iac-org-settings';
import { UnsupportedEntitlementCommandError } from './test/iac-local-execution/assert-iac-options-flag';
import config from '../../lib/config';
import { addIacDriftAnalytics } from './test/iac-local-execution/analytics';
import * as analytics from '../../lib/analytics';
import { findAndLoadPolicy } from '../../lib/policy';

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

  const policy = await findAndLoadPolicy(process.cwd(), 'iac', options);
  options.ignore = driftignoreFromPolicy(policy);

  try {
    const describe = await runDriftCTL({
      options: { kind: 'describe', ...options },
    });
    analytics.add('iac-drift-exit-code', describe.code);
    if (describe.code === DCTL_EXIT_CODES.EXIT_ERROR) {
      process.exitCode = describe.code;
      throw new Error();
    }

    // Parse analysis JSON and add to analytics
    const analysis = parseDriftAnalysisResults(describe.stdout);
    addIacDriftAnalytics(analysis, options);

    const fmtResult = await runDriftCTL({
      options: { kind: 'fmt', ...options },
      input: describe.stdout,
    });
    process.stdout.write(fmtResult.stdout);
    process.exitCode = describe.code;
  } catch (e) {
    return Promise.reject(e);
  }
};
