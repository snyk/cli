import { makeRequest } from '../request';
import { getAuthHeader } from '../api-token';
import config from '../config';
import { assembleQueryString } from '../snyk-test/common';
import { OrgFeatureFlagResponse } from './types';
import { Options } from '../types';
import { AuthFailedError } from '../errors';
import * as Debug from 'debug';

const debug = Debug('snyk-feature-flags');
export const SHOW_MAVEN_BUILD_SCOPE = 'show-maven-build-scope';
export const SHOW_NPM_SCOPE = 'show-npm-scope';
const _ffCache = new Map<string, Map<string, OrgFeatureFlagResponse>>();

export async function isFeatureFlagSupportedForOrg(
  featureFlag: string,
  org: string,
): Promise<OrgFeatureFlagResponse> {
  let cachedOrg = org ? _ffCache.get(org) : undefined;
  const cachedFF = org ? cachedOrg?.get(featureFlag) : undefined;

  if (cachedFF) {
    return cachedFF;
  }

  const response = await makeRequest({
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
    qs: org ? assembleQueryString({ org }) : undefined,
    url: `${config.API}/cli-config/feature-flags/${featureFlag}`,
    gzip: true,
    json: true,
  });

  const body = response.body as OrgFeatureFlagResponse;

  if (body.code === 403 || body.code === 200) {
    if (!cachedOrg) {
      cachedOrg = new Map();
      _ffCache.set(org, cachedOrg);
    }
    cachedOrg.set(featureFlag, body);
  }

  return (response as any).body;
}

export async function hasFeatureFlag(
  featureFlag: string,
  options: Options,
): Promise<boolean | undefined> {
  const { code, error, ok } = await isFeatureFlagSupportedForOrg(
    featureFlag,
    options.org || '',
  );

  if (code === 401 || code === 403) {
    throw AuthFailedError(error, code);
  }
  return ok;
}

export async function hasFeatureFlagOrDefault(
  featureFlag: string,
  options: Options,
  defaultValue = false,
): Promise<boolean> {
  try {
    const result = await hasFeatureFlag(featureFlag, options);
    return result ?? defaultValue;
  } catch (err) {
    debug(`error checking feature flag '${featureFlag}':`, err);
    return defaultValue;
  }
}
