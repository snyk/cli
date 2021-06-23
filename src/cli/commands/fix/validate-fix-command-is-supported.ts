import * as Debug from 'debug';

import { getEcosystemForTest } from '../../../lib/ecosystems';

import { isFeatureFlagSupportedForOrg } from '../../../lib/feature-flags';
import { CommandNotSupportedError } from '../../../lib/errors/command-not-supported';
import { FeatureNotSupportedByEcosystemError } from '../../../lib/errors/not-supported-by-ecosystem';
import { Options, TestOptions } from '../../../lib/types';
import { AuthFailedError } from '../../../lib/errors';

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
    throw new CommandNotSupportedError('snyk fix', options.org || undefined);
  }

  return true;
}
