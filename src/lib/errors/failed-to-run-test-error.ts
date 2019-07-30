import {CustomError} from './custom-error';

export class FailedToRunTestError extends CustomError {
    private static ERROR_MESSAGE: string =
        'Failed to run a test';

    constructor(userMessage, errorCode?) {
      const code = errorCode || 500;
      super(userMessage || FailedToRunTestError.ERROR_MESSAGE);
      this.code = errorCode || code;
      this.userMessage = userMessage || FailedToRunTestError.ERROR_MESSAGE;
    }
}
