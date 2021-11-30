import { Options } from '../../types';
import config from '../../config';
import { getSastSettingsForOrg, trackUsage } from './checks';

import {
  AuthFailedError,
  FailedToRunTestError,
  FeatureNotSupportedForOrgError,
  NotFoundError,
  CustomError,
} from '../../errors';

export async function validateCodeTest(options: Options) {
  const org = options.org || config.org;

  // This is an unexpected path, code plugin executed for non-code command.
  if (!options.code) {
    throw new FeatureNotSupportedForOrgError(org);
  }

  const sastSettingsResponse = await getSastSettingsForOrg(org);

  if (
    sastSettingsResponse?.code === 401 ||
    sastSettingsResponse?.code === 403
  ) {
    throw AuthFailedError(
      sastSettingsResponse.error,
      sastSettingsResponse.code,
    );
  }

  if (sastSettingsResponse?.code === 404) {
    throw new NotFoundError(sastSettingsResponse?.userMessage);
  }

  if (!sastSettingsResponse.sastEnabled) {
    throw new FeatureNotSupportedForOrgError(
      org,
      'Snyk Code',
      'enable in Settings > Snyk Code',
    );
  }

  if (sastSettingsResponse.localCodeEngine.enabled) {
    throw new CustomError(
      'Snyk Code Local Engine is enabled, Snyk Code CLI is temporary disabled.',
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
