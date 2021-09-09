import { CustomError, ERROR_CODES } from './custom-error';

export class NoFixesCouldBeAppliedError extends CustomError {
  public tip?: string;

  public constructor(message?: string, tip?: string) {
    super(
      message || 'No fixes could be applied',
      ERROR_CODES.NoFixesCouldBeApplied,
    );
    this.tip = tip;
  }
}
