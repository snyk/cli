import { CLI } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';

export class ExcludeRelativeFlagInvalidInputError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_MESSAGE =
    'The --exclude-relative argument must be a comma separated list of relative file or directory paths. Absolute paths and parent directory references (..) are not allowed.';

  constructor() {
    super(ExcludeRelativeFlagInvalidInputError.ERROR_MESSAGE);
    this.code = ExcludeRelativeFlagInvalidInputError.ERROR_CODE;
    this.userMessage = ExcludeRelativeFlagInvalidInputError.ERROR_MESSAGE;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}
