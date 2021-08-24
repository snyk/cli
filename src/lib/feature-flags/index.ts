import { OrgFeatureFlagResponse } from './types';
import { fetchFeatureFlag } from './fetchFeatureFlag';

export async function isFeatureFlagSupportedForOrg(
  featureFlag: string,
  org,
): Promise<OrgFeatureFlagResponse> {
  return fetchFeatureFlag(featureFlag, org);
}

const cliFailFastValues: Map<string, OrgFeatureFlagResponse> = new Map();

export async function cliFailFast(
  org: string | undefined | null,
): Promise<boolean> {
  const orgCacheKey = org || 'NO_ORG';
  const cachedValue = cliFailFastValues.get(orgCacheKey);
  if (cachedValue) {
    return Boolean(cachedValue.ok);
  } else {
    const fetchedValue = await fetchFeatureFlag('cliFailFast', org);
    cliFailFastValues.set(orgCacheKey, fetchedValue);
    return Boolean(fetchedValue.ok);
  }
}
