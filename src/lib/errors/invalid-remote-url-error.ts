import { CLI } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';

export class InvalidRemoteUrlError extends CustomError {
  private static ERROR_MESSAGE =
    'Invalid argument provided for --remote-repo-url. Value must be a string.';

  constructor() {
    super(InvalidRemoteUrlError.ERROR_MESSAGE);
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}
