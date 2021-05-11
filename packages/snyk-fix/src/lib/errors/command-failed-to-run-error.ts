import { CustomError, ERROR_CODES } from './custom-error';

export class CommandFailedError extends CustomError {
  public command?: string;

  public constructor(customMessage: string, command?: string) {
    super(
      customMessage,
      ERROR_CODES.CommandFailed,
    );
    this.command = command;
  }
}
