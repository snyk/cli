import { CustomError } from './custom-error';

export class ExcludeFlagInvalidInputError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_MESSAGE =
    'The --exclude argument must be a comma separated list of directory or file names and cannot contain a path.';

  constructor() {
    super(ExcludeFlagInvalidInputError.ERROR_MESSAGE);
    this.code = ExcludeFlagInvalidInputError.ERROR_CODE;
    this.userMessage = ExcludeFlagInvalidInputError.ERROR_MESSAGE;
  }
}
