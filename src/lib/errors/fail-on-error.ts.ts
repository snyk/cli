import { CustomError } from './custom-error';
import { FAIL_ON } from '../snyk-test/common';

export class FailOnError extends CustomError {
  private static ERROR_MESSAGE =
    'Invalid fail on argument, please use one of: ' +
    Object.keys(FAIL_ON).join(' | ');

  constructor() {
    super(FailOnError.ERROR_MESSAGE);
  }
}
