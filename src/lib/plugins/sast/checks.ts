import { makeRequest } from '../../request';

import { api as getApiToken } from '../../api-token';
import config from '../../config';
import { assembleQueryString } from '../../snyk-test/common';

interface SastSettings {
  sastEnabled: boolean;
  code?: number;
  error?: string;
}

interface TrackUsageResponse {
  code?: number;
  userMessage?: string;
}

export async function getSastSettingsForOrg(org): Promise<SastSettings> {
  const response = await makeRequest({
    method: 'GET',
    headers: {
      Authorization: `token ${getApiToken()}`,
    },
    qs: assembleQueryString({ org }),
    url: `${config.API}/cli-config/settings/sast`,
    gzip: true,
    json: true,
  });

  return response.body as SastSettings;
}

export async function trackUsage(org): Promise<TrackUsageResponse> {
  const response = await makeRequest({
    method: 'POST',
    headers: {
      Authorization: `token ${getApiToken()}`,
    },
    qs: assembleQueryString({ org }),
    url: `${config.API}/track-sast-usage/cli`,
    gzip: true,
    json: true,
  });

  return response.body as TrackUsageResponse;
}
