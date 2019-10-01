import { CustomError } from './custom-error';

export class InternalServerError extends CustomError {
  private static ERROR_CODE = 500;
  private static ERROR_STRING_CODE = 'INTERNAL_SERVER_ERROR';
  private static ERROR_MESSAGE = 'Internal server error';

  constructor(userMessage) {
    super(InternalServerError.ERROR_MESSAGE);
    this.code = InternalServerError.ERROR_CODE;
    this.strCode = InternalServerError.ERROR_STRING_CODE;
    this.userMessage = userMessage || InternalServerError.ERROR_MESSAGE;
  }
}
