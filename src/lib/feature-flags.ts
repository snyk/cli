import { makeRequest } from './request';
import { getAuthHeader } from './api-token';
import * as config from './config';
import { assembleQueryString } from './snyk-test/common';

interface OrgFeatureFlagResponse {
  ok?: boolean;
  userMessage?: string;
  code?: number;
  error?: string;
}

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
