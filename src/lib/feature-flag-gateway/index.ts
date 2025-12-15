import { makeRequest } from '../request';
import config from '../config';
import { getAuthHeader } from '../api-token';
import { FeatureFlagsEvaluationResponse } from './types';

export const SHOW_MAVEN_BUILD_SCOPE = 'show-maven-build-scope';

export async function evaluateFeatureFlagsForOrg(
  flags: string[],
  orgId: string,
  version = '2024-10-15',
): Promise<FeatureFlagsEvaluationResponse> {
  if (!orgId) {
    throw new Error('orgId is required');
  }

  const url = `${config.API}/hidden/orgs/${encodeURIComponent(
    orgId,
  )}/feature_flags/evaluation`;

  const payload = {
    data: {
      type: 'feature_flags_evaluation',
      attributes: {
        flags,
        context: {
          orgId,
        },
      },
    },
  };

  const response = await makeRequest({
    method: 'POST',
    url,
    qs: { version },
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: getAuthHeader(),
    },
    body: payload,
    gzip: true,
    json: true,
  });

  return (response as any).body as FeatureFlagsEvaluationResponse;
}

export async function getFeatureFlagValue(
  flag: string,
  orgId?: string,
): Promise<boolean> {
  if (!orgId) {
    return false;
  }

  try {
    const result = await evaluateFeatureFlagsForOrg([flag], orgId);

    return (
      result.data.attributes.evaluations.find((e) => e.key === flag)?.value ??
      false
    );
  } catch (err) {
    return false;
  }
}
