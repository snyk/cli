import { CustomError } from './custom-error';
import * as config from '../config';

export function AuthFailedError(
  errorMessage: string = 'Authentication failed. Please check the API token on ' +
    config.ROOT +
    '\nIf it is correctly configured, try running `snyk auth [api key]` instead',
  errorCode = 401,
) {
  const error = new CustomError(errorMessage);
  error.code = errorCode;
  error.strCode = 'authfail';
  error.userMessage = errorMessage;
  return error;
}
