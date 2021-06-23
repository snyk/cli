import { Options } from '../../types';
import * as config from '../../config';
import { AuthFailedError, FeatureNotSupportedForOrgError } from '../../errors';

export async function validateCodeTest(options: Options) {
  const featureFlag = 'snykCodeCli';
  const org = options.org || config.org;

  if (!options.code) {
    throw new FeatureNotSupportedForOrgError(org);
  }

  // TODO: We would need to remove this once we fix circular import issue
  const { isFeatureFlagSupportedForOrg } = require('../../feature-flags');
  const isFeatureFlagRes = await isFeatureFlagSupportedForOrg(featureFlag, org);

  if (isFeatureFlagRes.code === 401 || isFeatureFlagRes.code === 403) {
    throw AuthFailedError(isFeatureFlagRes.error, isFeatureFlagRes.code);
  }

  if (isFeatureFlagRes.userMessage) {
    throw new FeatureNotSupportedForOrgError(org);
  }
}
