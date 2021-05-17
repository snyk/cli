import { Options } from '../../types';
import * as config from '../../config';

import { AuthFailedError, FeatureNotSupportedForOrgError } from '../../errors';

export async function validateCodeTest(options: Options) {
  const org = options.org || config.org;

  // This is an unexpected path, code plugin executed for non-code command.
  if (!options.code) {
    throw new FeatureNotSupportedForOrgError(org);
  }

  // TODO: We would need to remove this once we fix circular import issue
  const { getSastSettingsForOrg } = require('./settings');
  const sastSettingsResponse = await getSastSettingsForOrg(org);

  if (sastSettingsResponse.code === 401 || sastSettingsResponse.code === 403) {
    throw AuthFailedError(
      sastSettingsResponse.error,
      sastSettingsResponse.code,
    );
  }

  if (!sastSettingsResponse.sastEnabled) {
    throw new FeatureNotSupportedForOrgError(org, 'Snyk Code');
  }
}
