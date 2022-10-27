import { CustomError } from './custom-error';

export class FailedToRunTestError extends CustomError {
  private static ERROR_MESSAGE = 'Failed to run a test';
  public innerError: any | undefined;

  constructor(userMessage, errorCode?, innerError?: any) {
    const code = errorCode || 500;
    super(userMessage || FailedToRunTestError.ERROR_MESSAGE);
    this.code = errorCode || code;
    this.userMessage = userMessage || FailedToRunTestError.ERROR_MESSAGE;
    this.innerError = innerError;
  }
}
