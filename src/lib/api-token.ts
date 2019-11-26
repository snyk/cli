import { AuthFailedError, MissingApiTokenError } from './errors';

import * as config from './config';
import * as userConfig from './user-config';
import { isAuthed } from '../cli/commands/auth/is-authed';

export function api() {
  // note: config.TOKEN will potentially come via the environment
  return config.api || config.TOKEN || userConfig.get('api');
}

export async function apiTokenExists(): Promise<string> {
  const configured = api();
  if (!configured) {
    throw new MissingApiTokenError();
  }

  const isValid = await isAuthed();

  if (!isValid.ok) {
    throw AuthFailedError(isValid.message, isValid.code);
  }

  return configured;
}
