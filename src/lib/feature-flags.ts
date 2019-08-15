import request = require('./request');
import snyk = require('.'); // TODO(kyegupov): fix import
import * as config from './config';

interface OrgFeatureFlagResponse {
  ok: boolean;
  userMessage?: string;
}

export async function isFeatureFlagSupportedForOrg(featureFlag: string): Promise<OrgFeatureFlagResponse> {
  const response = await request({
    method: 'GET',
    headers: {
      Authorization: `token ${snyk.api}`,
    },
    url: `${config.API}/cli-config/feature-flags/${featureFlag}`,
    gzip: true,
    json: true,
  });

  return (response as any).body;
}
