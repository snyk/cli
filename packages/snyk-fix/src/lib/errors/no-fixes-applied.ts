import { CustomError, ERROR_CODES } from './custom-error';

export class NoFixesCouldBeAppliedError extends CustomError {
  public constructor() {
    super(
      'No fixes could be applied',
      ERROR_CODES.UnsupportedTypeError,
    );
  }
}
