import * as policy from 'snyk-policy';
import {
  FailedToLoadPolicyError,
  PolicyNotFoundError,
  CustomError,
} from '../../lib/errors';
import { IgnoreRulePerPath } from '../../lib/generate-ignore-rule';
import { PatchRemediation } from '../../lib/snyk-test/legacy';

export interface Policy {
  ignore?: IgnoreRulePerPath;
  patch?: PatchRemediation;
  failThreshold?: 'high' | 'medium' | 'low';
}

export async function loadOrCreatePolicy(
  path = process.cwd(),
): Promise<Policy> {
  try {
    return await loadPolicy(path);
  } catch (error) {
    if (error instanceof PolicyNotFoundError) {
      // file does not exist - create it
      return await policy.create();
    }
    throw error;
  }
}

export async function loadPolicy(path = process.cwd()): Promise<Policy> {
  try {
    return await policy.load(path);
  } catch (err) {
    let policyError: CustomError;
    if (err.code === 'ENOENT') {
      policyError = new PolicyNotFoundError();
    } else {
      policyError = new FailedToLoadPolicyError();
      policyError.innerError = err;
    }
    throw policyError;
  }
}
