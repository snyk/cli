import * as Debug from 'debug';

import { getEcosystemForTest } from '../../../lib/ecosystems';

import { isFeatureFlagSupportedForOrg } from '../../../lib/feature-flags';
import { FeatureNotSupportedByEcosystemError } from '../../../lib/errors/not-supported-by-ecosystem';
import { Options, TestOptions } from '../../../lib/types';
import { AuthFailedError } from '../../../lib/errors';
import chalk from 'chalk';

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

  const snykFixSupported = await isFeatureFlagSupportedForOrg(
    snykFixFeatureFlag,
    options.org,
  );

  debug('Feature flag check returned: ', snykFixSupported);

  if (snykFixSupported.code === 401 || snykFixSupported.code === 403) {
    throw AuthFailedError(snykFixSupported.error, snykFixSupported.code);
  }

  if (!snykFixSupported.ok) {
    const snykFixErrorMessage =
      chalk.red(
        `\`snyk fix\` is not supported${
          options.org ? ` for org '${options.org}'` : ''
        }.`,
      ) +
      '\nSee documentation on how to enable this beta feature: https://docs.snyk.io/snyk-cli/fix-vulnerabilities-from-the-cli/automatic-remediation-with-snyk-fix#enabling-snyk-fix';
    const unsupportedError = new Error(snykFixErrorMessage);
    throw unsupportedError;
  }

  return true;
}
