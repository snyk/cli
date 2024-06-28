import { CustomError } from './custom-error';

export class MissingApiTokenError extends CustomError {
  private static ERROR_CODE = 401;
  private static ERROR_STRING_CODE = 'NO_API_TOKEN';
  private static ERROR_MESSAGE =
    '`snyk` requires an authenticated account. Please run `snyk auth` and try again.';

  /**
   * isMissingApiToken returns whether the error instance is a missing API token
   * error.
   *
   * Defined as a property so that the same expression resolves as "falsy"
   * (undefined) when other error types are tested.
   */
  public get isMissingApiToken(): boolean {
    return this.strCode === MissingApiTokenError.ERROR_STRING_CODE;
  }

  constructor() {
    super(MissingApiTokenError.ERROR_MESSAGE);
    this.code = MissingApiTokenError.ERROR_CODE;
    this.strCode = MissingApiTokenError.ERROR_STRING_CODE;
    this.userMessage = MissingApiTokenError.ERROR_MESSAGE;
  }
}
