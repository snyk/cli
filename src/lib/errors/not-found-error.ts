import { CustomError } from './custom-error';

export class NotFoundError extends CustomError {
  private static ERROR_CODE = 404;
  private static ERROR_MESSAGE = "Couldn't find the requested resource";

  constructor(userMessage) {
    super(userMessage || NotFoundError.ERROR_MESSAGE);
    this.code = NotFoundError.ERROR_CODE;
    this.userMessage = userMessage || NotFoundError.ERROR_MESSAGE;
  }
}
