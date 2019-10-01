import { CustomError } from './custom-error';

export class ConnectionTimeoutError extends CustomError {
  private static ERROR_MESSAGE = 'Connection timeout.';

  constructor() {
    super(ConnectionTimeoutError.ERROR_MESSAGE);
    this.code = 504;
    this.userMessage = ConnectionTimeoutError.ERROR_MESSAGE;
  }
}
