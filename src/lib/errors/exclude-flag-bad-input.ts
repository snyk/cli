import { CustomError } from './custom-error';

export class ExcludeFlagBadInputError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_MESSAGE =
    'Empty --exclude argument. Did you mean --exclude=subdirectory ?';

  constructor() {
    super(ExcludeFlagBadInputError.ERROR_MESSAGE);
    this.code = ExcludeFlagBadInputError.ERROR_CODE;
    this.userMessage = ExcludeFlagBadInputError.ERROR_MESSAGE;
  }
}
