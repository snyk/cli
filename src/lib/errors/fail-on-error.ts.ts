import { CustomError } from './custom-error';
import { FAIL_ON } from '../snyk-test/common';
import { CLI } from '@snyk/error-catalog-nodejs-public';

export class FailOnError extends CustomError {
  private static ERROR_MESSAGE =
    'Invalid fail on argument, please use one of: ' +
    Object.keys(FAIL_ON).join(' | ');

  constructor() {
    super(FailOnError.ERROR_MESSAGE);
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}
