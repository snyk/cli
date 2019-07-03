import * as policy from 'snyk-policy';
import {display} from '../../lib/display-policy';
import * as errors from '../../lib/errors';

export async function displayPolicy(path) {
  try {
    const loadedPolicy = await policy.load(path || process.cwd());
    return await display(loadedPolicy);
  } catch (error) {
      if (error.code === 'ENOENT') {
        error = new errors.PolicyNotFoundError();
      } else {
        error = new errors.FailedToLoadPolicyError();
        error.innerError = error;
      }
      throw error;
    }
}
