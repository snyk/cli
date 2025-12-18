import * as Debug from 'debug';

import { getEcosystemForTest } from '../../../lib/ecosystems';

import { FeatureNotSupportedByEcosystemError } from '../../../lib/errors/not-supported-by-ecosystem';
import { Options, TestOptions } from '../../../lib/types';
import { AuthFailedError } from '../../../lib/errors';
import chalk from 'chalk';
import { getEnabledFeatureFlags } from '../../../lib/feature-flag-gateway';
import { getOrganizationID } from '../../../lib/organization';

const debug = Debug('snyk-fix');
const snykFixFeatureFlag = 'cliSnykFix';

export async function validateFixCommandIsSupported(
  options: Options & TestOptions,
): Promise<boolean> {
  if (options.docker) {
    throw new FeatureNotSupportedByEcosystemError('snyk fix', 'docker');
  }

  const ecosystem = getEcosystemForTest(options);
  if (ecosystem) {
    throw new FeatureNotSupportedByEcosystemError('snyk fix', ecosystem);
  }

  //Batch fetch of feature flags to reduce latency
  const orgID = getOrganizationID();
  const featureFlags = await getEnabledFeatureFlags(
    [snykFixFeatureFlag],
    orgID,
  );
  const snykFixSupported = featureFlags.has(snykFixFeatureFlag);

  debug('Feature flag check returned: ', snykFixSupported);

  if (!snykFixSupported) {
    throw AuthFailedError('snykFixSupported is false', 403);
  }

  if (!snykFixSupported) {
    const snykFixErrorMessage =
      chalk.red(
        `\`snyk fix\` is not supported${orgID ? ` for org '${orgID}'` : ''}.`,
      ) +
      '\nSee documentation on how to enable this beta feature: https://docs.snyk.io/snyk-cli/fix-vulnerabilities-from-the-cli/automatic-remediation-with-snyk-fix#enabling-snyk-fix';
    const unsupportedError = new Error(snykFixErrorMessage);
    throw unsupportedError;
  }

  return true;
}
