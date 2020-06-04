import * as url from 'url';

export function getUtmsAsString(): string {
  const SNYK_UTM_MEDIUM = process.env.SNYK_UTM_MEDIUM || 'cli';
  const SNYK_UTM_SOURCE = process.env.SNYK_UTM_SOURCE || 'cli';
  const SNYK_UTM_CAMPAIGN = process.env.SNYK_UTM_CAMPAIGN || 'cli';

  if (!SNYK_UTM_MEDIUM && !SNYK_UTM_SOURCE && !SNYK_UTM_CAMPAIGN) {
    return '';
  }

  /* eslint-disable @typescript-eslint/camelcase */
  const utmQueryParams = new url.URLSearchParams({
    utm_medium: SNYK_UTM_MEDIUM,
    utm_source: SNYK_UTM_SOURCE,
    utm_campaign: SNYK_UTM_CAMPAIGN,
  });
  /* eslint-enable @typescript-eslint/camelcase */

  return utmQueryParams.toString();
}
