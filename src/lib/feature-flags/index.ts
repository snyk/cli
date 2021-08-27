import { OrgFeatureFlagResponse } from './types';
import { fetchFeatureFlag } from './fetchFeatureFlag';
import { Options } from '../types';

export async function isFeatureFlagSupportedForOrg(
  featureFlag: string,
  org,
): Promise<OrgFeatureFlagResponse> {
  return fetchFeatureFlag(featureFlag, org);
}

const cliFailFastValues: Map<string, OrgFeatureFlagResponse> = new Map();

export async function cliFailFast(
  options: Pick<Options, 'fail-fast' | 'org'>,
): Promise<boolean> {
  if (options['fail-fast']) {
    const orgCacheKey = options.org || 'NO_ORG';
    const cachedValue = cliFailFastValues.get(orgCacheKey);
    if (cachedValue) {
      return Boolean(cachedValue.ok);
    } else {
      const fetchedValue = await fetchFeatureFlag('cliFailFast', options.org);
      cliFailFastValues.set(orgCacheKey, fetchedValue);
      return Boolean(fetchedValue.ok);
    }
  } else {
    return false;
  }
}
