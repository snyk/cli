import request = require('./request');
import snyk = require('.'); // TODO(kyegupov): fix import
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
      Authorization: `token ${snyk.api}`,
    },
    qs: assembleQueryString({ org }),
    url: `${config.API}/cli-config/feature-flags/${featureFlag}`,
    gzip: true,
    json: true,
  });

  return (response as any).body;
}
