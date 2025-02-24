import { MethodArgs } from '../args';
import { processCommandArgs } from './process-command-args';
import * as legacyError from '../../lib/errors/legacy-errors';
import {
  driftignoreFromPolicy,
  parseDriftAnalysisResults,
  processAnalysis,
} from '../../lib/iac/drift';
import { CustomError } from '../../lib/errors';
import { getIacOrgSettings } from './test/iac/local-execution/org-settings/get-iac-org-settings';
import { UnsupportedEntitlementCommandError } from './test/iac/local-execution/assert-iac-options-flag';
import config from '../../lib/config';
import { addIacDriftAnalytics } from './test/iac/local-execution/analytics';
import * as analytics from '../../lib/analytics';
import { findAndLoadPolicy } from '../../lib/policy';
import { DCTL_EXIT_CODES, runDriftCTL } from '../../lib/iac/drift/driftctl';
import { IaCErrorCodes } from './test/iac/local-execution/types';
import { getErrorStringCode } from './test/iac/local-execution/error-utils';
import { DescribeOptions } from '../../lib/iac/types';
import { CLI } from '@snyk/error-catalog-nodejs-public';

export class FlagError extends CustomError {
  constructor(flag: string) {
    const msg = `Unsupported flag "${flag}" provided. Run snyk iac describe --help for supported flags`;
    super(msg);
    this.code = IaCErrorCodes.FlagError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}
export default async (...args: MethodArgs): Promise<any> => {
  const { options } = processCommandArgs(...args);

  // Ensure that this describe command can only be runned when using `snyk iac describe`
  // Avoid `snyk describe` direct usage
  if (options.iac != true) {
    return legacyError('describe');
  }

  if (options['only-managed']) {
    return Promise.reject(new FlagError('only-managed'));
  }

  // Ensure that we are allowed to run that command
  // by checking the entitlement
  const orgPublicId = options.org ?? config.org;
  const iacOrgSettings = await getIacOrgSettings(orgPublicId);
  if (!iacOrgSettings.entitlements?.iacDrift) {
    throw new UnsupportedEntitlementCommandError('drift', 'iacDrift');
  }

  const policy = await findAndLoadPolicy(process.cwd(), 'iac', options);
  const driftIgnore = driftignoreFromPolicy(policy);

  try {
    const describe = await runDriftCTL({
      options: { ...options, kind: 'describe' },
      driftIgnore: driftIgnore,
    });

    process.exitCode = describe.code;

    analytics.add('is-iac-drift', true);
    analytics.add('iac-drift-exit-code', describe.code);
    if (describe.code === DCTL_EXIT_CODES.EXIT_ERROR) {
      throw new Error();
    }

    // Parse analysis JSON and add to analytics
    const analysis = parseDriftAnalysisResults(describe.stdout);
    addIacDriftAnalytics(analysis, options as DescribeOptions);

    const output = await processAnalysis(options as DescribeOptions, describe);
    process.stdout.write(output);
  } catch (e) {
    return Promise.reject(e);
  }
};
