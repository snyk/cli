import * as url from 'url';
import * as os from 'os';
import { ArgsOptions } from './../cli/args';
import { isDocker } from './is-docker';
import { getIntegrationName, getIntegrationVersion } from './analytics/sources';

export function getQueryParamsAsString(args: ArgsOptions[]): string {
  const utm_source = process.env.SNYK_UTM_SOURCE || 'cli';
  const utm_medium = process.env.SNYK_UTM_MEDIUM || 'cli';
  const utm_campaign =
    process.env.SNYK_UTM_CAMPAIGN || getIntegrationName(args) || 'cli';
  const utm_campaign_content =
    process.env.SNYK_UTM_CAMPAIGN_CONTENT || getIntegrationVersion(args);
  const osType = os.type()?.toLowerCase();
  const docker = isDocker().toString();

  const queryParams = new url.URLSearchParams({
    utm_medium,
    utm_source,
    utm_campaign,
    utm_campaign_content,
    os: osType,
    docker,
  });

  // It may not be set and URLSearchParams won't filter out undefined values
  if (!utm_campaign_content) {
    queryParams.delete('utm_campaign_content');
  }

  return queryParams.toString();
}
