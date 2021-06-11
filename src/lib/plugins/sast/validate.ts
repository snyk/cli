import { Options } from '../../types';
import * as config from '../../config';

import {
  AuthFailedError,
  FailedToRunTestError,
  FeatureNotSupportedForOrgError,
} from '../../errors';

export async function validateCodeTest(options: Options) {
  const org = options.org || config.org;

  // This is an unexpected path, code plugin executed for non-code command.
  if (!options.code) {
    throw new FeatureNotSupportedForOrgError(org);
  }

  // TODO: We would need to remove this once we fix circular import issue
  const { getSastSettingsForOrg, trackUsage } = require('./checks');
  const { isFeatureFlagSupportedForOrg } = require('../../feature-flags');

  const [
    sastSettingsResponse,
    snykCodeEnabledResponse,
    snykCodeCliEnabledResponse,
  ] = await Promise.all([
    getSastSettingsForOrg(org),
    isFeatureFlagSupportedForOrg('snykCode', org),
    isFeatureFlagSupportedForOrg('snykCodeCli', org),
  ]);

  const authError = [
    sastSettingsResponse,
    snykCodeEnabledResponse,
    snykCodeCliEnabledResponse,
  ].find((response) => response.code === 401 || response.code === 403);

  if (authError) {
    throw AuthFailedError(authError.error, authError.code);
  }

  if (!snykCodeEnabledResponse.ok || !snykCodeCliEnabledResponse.ok) {
    throw new FeatureNotSupportedForOrgError(org, 'Snyk Code');
  }

  if (!sastSettingsResponse.sastEnabled) {
    throw new FeatureNotSupportedForOrgError(
      org,
      'Snyk Code',
      'enable in Settings > Snyk Code',
    );
  }

  const trackUsageResponse = await trackUsage(org);
  if (trackUsageResponse.code === 429) {
    throw new FailedToRunTestError(
      trackUsageResponse.userMessage,
      trackUsageResponse.code,
    );
  }
}
