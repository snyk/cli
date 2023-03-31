import { CustomError } from './custom-error';

export class ServiceUnavailableError extends CustomError {
  private static ERROR_CODE = 503;
  private static ERROR_STRING_CODE = 'SERVICE_UNAVAILABLE_ERROR';
  private static ERROR_MESSAGE = 'Service unavailable error';

  constructor(userMessage) {
    super(ServiceUnavailableError.ERROR_MESSAGE);
    this.code = ServiceUnavailableError.ERROR_CODE;
    this.strCode = ServiceUnavailableError.ERROR_STRING_CODE;
    this.userMessage = userMessage || ServiceUnavailableError.ERROR_MESSAGE;
  }
}
