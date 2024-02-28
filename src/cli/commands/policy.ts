import * as policy from 'snyk-policy';
import { display } from '../../lib/display-policy';
import {
  FailedToLoadPolicyError,
  PolicyNotFoundError,
  CustomError,
} from '../../lib/errors';

export default async function displayPolicy(path?: string): Promise<string> {
  try {
    const loadedPolicy = (await policy.load(
      path || process.cwd(),
    )) as Promise<string>;
    return await display(loadedPolicy);
  } catch (error) {
    let adaptedError: CustomError;
    if (error.code === 'ENOENT') {
      adaptedError = new PolicyNotFoundError();
    } else {
      adaptedError = new FailedToLoadPolicyError();
      adaptedError.innerError = error;
    }
    throw adaptedError;
  }
}
