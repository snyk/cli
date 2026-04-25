import { CustomError } from './custom-error';
import { createErrorCatalogFromStatusCode } from './error-catalog-factory';

export class MonitorError extends CustomError {
  private static ERROR_MESSAGE =
    'Server returned unexpected error for the monitor request. ';

  constructor(errorCode, message) {
    const errorMessage = message ? `, response: ${message}` : '';
    const code = errorCode || 500;
    super(MonitorError.ERROR_MESSAGE + `Status code: ${code}${errorMessage}`);
    this.code = code;
    this.userMessage = message;
    this.errorCatalog = createErrorCatalogFromStatusCode(code);
  }
}
