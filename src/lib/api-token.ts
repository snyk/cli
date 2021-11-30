import { MissingApiTokenError } from '../lib/errors';
import config from './config';
import { config as userConfig } from './user-config';
import { isCI } from './is-ci';
import { MisconfiguredAuthInCI } from './errors/misconfigured-auth-in-ci-error';

export function api(): string | undefined {
  // note: config.TOKEN will potentially come via the environment
  return config.api || config.TOKEN || userConfig.get('api');
}

export function getOAuthToken(): string | undefined {
  return process.env.SNYK_OAUTH_TOKEN;
}

export function getDockerToken(): string | undefined {
  return process.env.SNYK_DOCKER_TOKEN;
}

export function apiTokenExists(): string {
  const token = api();
  if (!token) {
    if (isCI()) {
      throw new MisconfiguredAuthInCI();
    }
    throw new MissingApiTokenError();
  }
  return token;
}

export function apiOrOAuthTokenExists(): string {
  const oauthToken = getOAuthToken();
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

export function someTokenExists(): boolean {
  return Boolean(getOAuthToken() || getDockerToken() || api());
}
