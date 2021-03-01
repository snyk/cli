import { Options } from '../../types';
import * as config from '../../config';
import { AuthFailedError, FeatureNotSupportedForOrgError } from '../../errors';

export async function validateCodeTest(options: Options) {
  const featureFlag = 'snykCodeCli';
  const org = options.org || config.org;

  if (!options.code) {
    throw new FeatureNotSupportedForOrgError(org);
  }

  // TODO: We would nee to remove this once we fix circular import issue
  const { isFeatureFlagSupportedForOrg } = require('../../feature-flags');
  const snykCodeRes = await isFeatureFlagSupportedForOrg(featureFlag, org);

  if (snykCodeRes.code === 401 || snykCodeRes.code === 403) {
    throw AuthFailedError(snykCodeRes.error, snykCodeRes.code);
  }

  if (snykCodeRes.userMessage) {
    throw new FeatureNotSupportedForOrgError(org);
  }
}
