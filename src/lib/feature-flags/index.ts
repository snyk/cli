import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import config from '../config';
import { assembleQueryString } from '../snyk-test/common';
import { OrgFeatureFlagResponse } from './types';
import { Options } from '../types';
import { AuthFailedError } from '../errors';

export async function isFeatureFlagSupportedForOrg(
  featureFlag: string,
  org,
): Promise<OrgFeatureFlagResponse> {
  const response = await makeRequest({
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
    qs: assembleQueryString({ org }),
    url: `${config.API}/cli-config/feature-flags/${featureFlag}`,
    gzip: true,
    json: true,
  });

  return (response as any).body;
}

export async function hasFeatureFlag(
  featureFlag: string,
  options: Options,
): Promise<boolean | undefined> {
  const { code, error, ok } = await isFeatureFlagSupportedForOrg(
    featureFlag,
    options.org,
  );

  if (code === 401 || code === 403) {
    throw AuthFailedError(error, code);
  }
  return ok;
}
