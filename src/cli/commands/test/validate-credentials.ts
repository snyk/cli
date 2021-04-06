import {
  apiTokenExists,
  getOAuthToken,
  getDockerToken,
} from '../../../lib/api-token';
import { TestOptions, Options } from '../../../lib/types';

export function validateCredentials(options: Options & TestOptions): void {
  try {
    apiTokenExists();
  } catch (err) {
    if (getOAuthToken()) {
      return;
    } else if (options.docker && getDockerToken()) {
      options.testDepGraphDockerEndpoint = '/docker-jwt/test-dependencies';
      options.isDockerUser = true;
    } else {
      throw err;
    }
  }
}
