import { CustomError } from './custom-error';
import config from '../config';

export class AuthFailedError extends CustomError {
  private static ERROR_CODE = 401;
  private static ERROR_STRING_CODE = 'authfail';
  private static ERROR_MESSAGE =
    'Authentication failed. Please check the API token on ' + config.ROOT;

  constructor(
    message = AuthFailedError.ERROR_MESSAGE,
    code = AuthFailedError.ERROR_CODE,
  ) {
    super(message);
    this.code = code;
    this.strCode = AuthFailedError.ERROR_STRING_CODE;
    this.userMessage = message;
  }
}
