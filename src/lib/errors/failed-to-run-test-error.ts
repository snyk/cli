import { ProblemError } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';
import { CLI } from '@snyk/error-catalog-nodejs-public';

export class FailedToRunTestError extends CustomError {
  private static ERROR_MESSAGE = 'Failed to run a test';
  public innerError: any | undefined;

  constructor(
    userMessage,
    errorCode?,
    innerError?: any,
    errorCatalog?: ProblemError,
  ) {
    const code = errorCode || 500;
    super(userMessage || FailedToRunTestError.ERROR_MESSAGE);
    this.code = errorCode || code;
    this.userMessage = userMessage || FailedToRunTestError.ERROR_MESSAGE;
    this.innerError = innerError;
    this.errorCatalog = errorCatalog ?? new CLI.GeneralCLIFailureError('');
  }
}
