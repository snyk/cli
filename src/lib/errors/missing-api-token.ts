import {CustomError} from './custom-error';
import * as types from '../types';

export function MissingApiTokenError() {
  const message = '`snyk` requires an authenticated account. ' +
  'Please run `snyk auth` and try again.';
  const error = new CustomError(message);
  error.code = 401;
  error.strCode = 'NO_API_TOKEN';
  error.userMessage = message;
  return error;
}
