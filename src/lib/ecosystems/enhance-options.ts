import { Options } from '../types';

import { Ecosystem } from './types';
import { AuthFailedError } from '../errors';
import { isFeatureFlagSupportedForOrg } from '../feature-flags';

/**
 * @deprecated: do not use it, it's going to be deleted soon as the new snyk-cpp-plugin flow is completed
 */
export async function hasToDetourToLegacyFlow(
  ecosystem: Ecosystem,
  options: Options,
): Promise<boolean> {
  if (ecosystem !== 'cpp' || !options.org) {
    return false;
  }

  const response = await isFeatureFlagSupportedForOrg(
    'snykLegacyCpp',
    options.org,
  );
  if (response.code === 401) {
    throw AuthFailedError(response.error, response.code);
  }

  return response.ok ? true : false;
}
