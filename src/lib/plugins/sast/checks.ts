import { makeRequest } from '../../request';

import { getAuthHeader } from '../../api-token';
import config from '../../config';
import { assembleQueryString } from '../../snyk-test/common';
import { SastSettings, TrackUsageResponse } from './types';

export async function getSastSettingsForOrg(org): Promise<SastSettings> {
  const response = await makeRequest({
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
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
      Authorization: getAuthHeader(),
    },
    qs: assembleQueryString({ org }),
    url: `${config.API}/track-sast-usage/cli`,
    gzip: true,
    json: true,
  });

  return response.body as TrackUsageResponse;
}
