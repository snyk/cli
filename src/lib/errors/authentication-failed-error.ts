import { CustomError } from './custom-error';
import { Snyk } from '@snyk/error-catalog-nodejs-public';
import config from '../config';

export function AuthFailedError(
  errorMessage: string = 'Authentication failed. Please check the API token on ' +
    config.ROOT,
  errorCode = 401,
) {
  const error = new CustomError(errorMessage);
  error.code = errorCode;
  error.strCode = 'authfail';
  error.userMessage = errorMessage;
  error.errorCatalog = new Snyk.UnauthorisedError('');
  return error;
}
