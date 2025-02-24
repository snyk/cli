import { CustomError } from './custom-error';
import { Snyk } from '@snyk/error-catalog-nodejs-public';

export class ConnectionTimeoutError extends CustomError {
  private static ERROR_MESSAGE = 'Connection timeout.';

  constructor() {
    super(ConnectionTimeoutError.ERROR_MESSAGE);
    this.code = 504;
    this.userMessage = ConnectionTimeoutError.ERROR_MESSAGE;
    this.errorCatalog = new Snyk.TimeoutError('');
  }
}
