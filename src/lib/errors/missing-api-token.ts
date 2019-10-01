import { CustomError } from './custom-error';

export class MissingApiTokenError extends CustomError {
  private static ERROR_CODE = 401;
  private static ERROR_STRING_CODE = 'NO_API_TOKEN';
  private static ERROR_MESSAGE =
    '`snyk` requires an authenticated account. Please run `snyk auth` and try again.';

  constructor() {
    super(MissingApiTokenError.ERROR_MESSAGE);
    this.code = MissingApiTokenError.ERROR_CODE;
    this.strCode = MissingApiTokenError.ERROR_STRING_CODE;
    this.userMessage = MissingApiTokenError.ERROR_MESSAGE;
  }
}
