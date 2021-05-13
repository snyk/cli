import { MissingApiTokenError } from '../lib/errors';

import * as config from './config';
import { config as userConfig } from './user-config';

export function api() {
  // note: config.TOKEN will potentially come via the environment
  return config.api || config.TOKEN || userConfig.get('api');
}

export function getOAuthToken(): string | undefined {
  return process.env.SNYK_OAUTH_TOKEN;
}

export function getDockerToken(): string | undefined {
  return process.env.SNYK_DOCKER_TOKEN;
}

export function apiTokenExists() {
  const configured = api();
  if (!configured) {
    throw new MissingApiTokenError();
  }
  return configured;
}

export function apiOrOAuthTokenExists() {
  const oauthToken: string | undefined = getOAuthToken();
  if (oauthToken) {
    return oauthToken;
  }
  return apiTokenExists();
}

export function getAuthHeader(): string {
  const oauthToken: string | undefined = getOAuthToken();
  const dockerToken: string | undefined = getDockerToken();

  if (oauthToken) {
    return `Bearer ${oauthToken}`;
  }
  if (dockerToken) {
    return `Bearer ${dockerToken}`;
  }
  return `token ${api()}`;
}
