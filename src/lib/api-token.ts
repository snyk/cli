import { MissingApiTokenError } from '../lib/errors/missing-api-token';

import * as config from './config';
import * as userConfig from './user-config';
import * as types from './types';

export function api() {
  // note: config.TOKEN will potentially come via the environment
  return config.api || config.TOKEN || userConfig.get('api');
}

export function apiTokenExists() {
  const configured = api();
  if (!configured) {
    throw MissingApiTokenError();
  }
  return configured;
}
