import { CustomError } from './custom-error';

export class FailedToRunClientSbomError extends CustomError {
  private static ERROR_MESSAGE = 'Failed to run client-sbom';

  constructor(userMessage, errorCode?) {
    const code = errorCode || 500;
    super(userMessage || FailedToRunClientSbomError.ERROR_MESSAGE);
    this.code = errorCode || code;
    this.userMessage = userMessage || FailedToRunClientSbomError.ERROR_MESSAGE;
  }
}
