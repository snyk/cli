import { CustomError, ERROR_CODES } from './custom-error';

export class NoFixesCouldBeAppliedError extends CustomError {
  public constructor() {
    super(
      'No fixes could be applied. Please contact support@snyk.io',
      ERROR_CODES.UnsupportedTypeError,
    );
  }
}
