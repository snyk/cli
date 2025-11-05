import { CustomError } from './custom-error';
import { Snyk } from '@snyk/error-catalog-nodejs-public';
import { createErrorCatalogFromStatusCode } from './error-catalog-factory';
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
  
  // Use factory to create error catalog with the correct status code
  if (errorCode === 401) {
    // For 401, use the standard UnauthorisedError
    error.errorCatalog = new Snyk.UnauthorisedError('');
  } else {
    // For other codes (like 403), use factory to preserve the status
    error.errorCatalog = createErrorCatalogFromStatusCode(errorCode);
  }
  return error;
}
