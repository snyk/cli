import * as policy from 'snyk-policy';
import {display} from '../../lib/display-policy';
import {FailedToLoadPolicyError, PolicyNotFoundError} from '../../lib/errors';

async function displayPolicy(path?: string): Promise<string> {
  try {
    const loadedPolicy = await policy.load(path || process.cwd()) as Promise<string>;
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

export = displayPolicy;
