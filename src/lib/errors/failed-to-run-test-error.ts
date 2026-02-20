import { ProblemError } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';
import { createErrorCatalogFromStatusCode } from './error-catalog-factory';

export class FailedToRunTestError extends CustomError {
  private static ERROR_MESSAGE = 'Failed to run a test';
  public innerError: any | undefined;

  constructor(
    userMessage,
    errorCode?,
    innerError?: any,
    errorCatalog?: ProblemError,
  ) {
    // if errorCode is not provided, we're using 0 as 0 is not a valid http status code
    // ideally and eventually we will use custom errors across the board and this will be removed.
    const code = errorCode || 0;
    super(userMessage || FailedToRunTestError.ERROR_MESSAGE);
    this.code = code;
    this.userMessage = userMessage || FailedToRunTestError.ERROR_MESSAGE;
    this.innerError = innerError;
    this.errorCatalog = errorCatalog ?? createErrorCatalogFromStatusCode(code);
  }
}
