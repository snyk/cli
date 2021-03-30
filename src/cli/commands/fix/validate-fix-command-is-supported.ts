import * as Debug from 'debug';

import { getEcosystemForTest } from '../../../lib/ecosystems';

import { isFeatureFlagSupportedForOrg } from '../../../lib/feature-flags';
import { CommandNotSupportedError } from '../../../lib/errors/command-not-supported';
import { FeatureNotSupportedByEcosystemError } from '../../../lib/errors/not-supported-by-ecosystem';
import { Options, TestOptions } from '../../../lib/types';

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

  if (!snykFixSupported.ok) {
    debug(snykFixSupported.userMessage);
    throw new CommandNotSupportedError('snyk fix', options.org || undefined);
  }

  return true;
}
