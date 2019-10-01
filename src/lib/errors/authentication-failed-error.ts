import { CustomError } from './custom-error';
import * as config from '../config';

export function AuthFailedError(errorMessage, errorCode) {
  const message = errorMessage
    ? errorMessage
    : 'Authentication failed. Please check the API token on ' + config.ROOT;
  const error = new CustomError(message);
  error.code = errorCode || 401;
  error.strCode = 'authfail';
  error.userMessage = message;
  return error;
}
