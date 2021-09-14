import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import config from '../config';
import { assembleQueryString } from '../snyk-test/common';
import { OrgFeatureFlagResponse } from './types';

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
