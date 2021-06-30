import request = require('./request');
import { api as getApiToken } from './api-token';
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
  const response = await request({
    method: 'GET',
    headers: {
      Authorization: `token ${getApiToken()}`,
    },
    qs: assembleQueryString({ org }),
    url: `${config.API}/cli-config/feature-flags/${featureFlag}`,
    gzip: true,
    json: true,
  });

  return (response as any).body;
}
