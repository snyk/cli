import * as url from 'url';
import * as os from 'os';
import { isDocker } from './is-docker';

export function getQueryParamsAsString(): string {
  const SNYK_UTM_MEDIUM = process.env.SNYK_UTM_MEDIUM || 'cli';
  const SNYK_UTM_SOURCE = process.env.SNYK_UTM_SOURCE || 'cli';
  const SNYK_UTM_CAMPAIGN = process.env.SNYK_UTM_CAMPAIGN || 'cli';
  const osType = os.type()?.toLowerCase();
  const docker = isDocker().toString();

  /* eslint-disable @typescript-eslint/camelcase */
  const queryParams = new url.URLSearchParams({
    utm_medium: SNYK_UTM_MEDIUM,
    utm_source: SNYK_UTM_SOURCE,
    utm_campaign: SNYK_UTM_CAMPAIGN,
    os: osType,
    docker,
  });
  /* eslint-enable @typescript-eslint/camelcase */
  return queryParams.toString();
}
