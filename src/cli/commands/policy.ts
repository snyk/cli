import * as policy from 'snyk-policy';
import {display} from '../../lib/display-policy';
import {FailedToLoadPolicyError, PolicyNotFoundError} from '../../lib/errors';

export async function displayPolicy(path) {
  try {
    const loadedPolicy = await policy.load(path || process.cwd());
    return await display(loadedPolicy);
  } catch (error) {
      if (error.code === 'ENOENT') {
        error = new PolicyNotFoundError();
      } else {
        error = new FailedToLoadPolicyError();
        error.innerError = error;
      }
      throw error;
    }
}
