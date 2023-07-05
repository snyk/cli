import { CustomError } from './custom-error';

export class BadGatewayError extends CustomError {
  private static ERROR_CODE = 502;
  private static ERROR_STRING_CODE = 'BAD_GATEWAY_ERROR';
  private static ERROR_MESSAGE = 'Bad gateway error';

  constructor(userMessage) {
    super(BadGatewayError.ERROR_MESSAGE);
    this.code = BadGatewayError.ERROR_CODE;
    this.strCode = BadGatewayError.ERROR_STRING_CODE;
    this.userMessage = userMessage || BadGatewayError.ERROR_MESSAGE;
  }
}
