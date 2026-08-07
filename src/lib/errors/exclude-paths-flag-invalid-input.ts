import { CLI } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';

export class ExcludePathsFlagInvalidInputError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_MESSAGE =
    'The --exclude-paths argument must be a comma separated list of file or directory paths.';

  constructor() {
    super(ExcludePathsFlagInvalidInputError.ERROR_MESSAGE);
    this.code = ExcludePathsFlagInvalidInputError.ERROR_CODE;
    this.userMessage = ExcludePathsFlagInvalidInputError.ERROR_MESSAGE;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}
