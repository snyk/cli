import { Options } from '../../types';
import * as config from '../../config';
import { isFeatureFlagSupportedForOrg } from '../../feature-flags';
import { AuthFailedError, FeatureNotSupportedForOrgError } from '../../errors';

export async function isCodeTest(options: Options) {
  if (!options.code) {
    return false;
  }
  const org = options.org || config.org;
  const featureFlag = 'snykCodeCli';
  const snykCodeRes = await isFeatureFlagSupportedForOrg(featureFlag, org);

  if (snykCodeRes.code === 401 || snykCodeRes.code === 403) {
    throw AuthFailedError(snykCodeRes.error, snykCodeRes.code);
  }

  if (snykCodeRes.userMessage) {
    throw new FeatureNotSupportedForOrgError(org);
  }
  return true;
}
