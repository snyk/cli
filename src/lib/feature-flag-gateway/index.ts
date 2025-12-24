import config from '../config';
import { getAuthHeader } from '../api-token';
import { FeatureFlagsEvaluationResponse } from './types';
import { makeRequest } from '../request';
import { AuthFailedError, ValidationError } from '../errors';
import { TestLimitReachedError } from '../../cli/commands/test/iac/local-execution/usage-tracking';

export const SHOW_MAVEN_BUILD_SCOPE = 'show-maven-build-scope';

export async function evaluateFeatureFlagsForOrg(
  flags: string[],
  orgId: string,
  version = '2024-10-15',
): Promise<FeatureFlagsEvaluationResponse> {
  if (!orgId.trim()) {
    throw new Error('orgId is required');
  }

  const url =
    `${config.API_HIDDEN_URL}/orgs/${encodeURIComponent(orgId)}` +
    `/feature_flags/evaluation?version=${encodeURIComponent(version)}`;

  const payload = {
    data: {
      type: 'feature_flags_evaluation',
      attributes: { flags },
    },
  };

  const { res, body } = await makeRequest({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Authorization: getAuthHeader(),
    },
    body: payload,
    json: true,
    noCompression: true,
  });

  switch (res.statusCode) {
    case 200:
      break;
    case 401:
      throw AuthFailedError();
    case 429:
      throw new TestLimitReachedError();
    default:
      throw new ValidationError(
        res.body?.error ?? 'An error occurred, please contact Snyk support',
      );
  }

  if (body?.errors?.length) {
    const first = body.errors[0];
    throw new Error(
      `Feature flag evaluation failed: ${first?.status ?? res.statusCode} ${
        first?.detail ?? res.statusMessage
      }`,
    );
  }

  return body as FeatureFlagsEvaluationResponse;
}

export async function getFeatureFlagValue(
  flag: string,
  orgId: string,
): Promise<boolean> {
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
