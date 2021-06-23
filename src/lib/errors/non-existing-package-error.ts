import { CustomError } from './custom-error';

export class NonExistingPackageError extends CustomError {
  private static ERROR_CODE = 404;
  private static ERROR_MESSAGE = "Couldn't find the requested package";

  constructor() {
    super(NonExistingPackageError.ERROR_MESSAGE);
    this.code = NonExistingPackageError.ERROR_CODE;
    this.userMessage = NonExistingPackageError.ERROR_MESSAGE;
  }
}
