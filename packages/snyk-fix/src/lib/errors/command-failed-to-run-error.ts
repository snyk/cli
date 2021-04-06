import { CustomError, ERROR_CODES } from './custom-error';

export class CommandFailedError extends CustomError {
  public constructor(customMessage: string) {
    super(
      customMessage,
      ERROR_CODES.CommandFailed,
    );
  }
}
