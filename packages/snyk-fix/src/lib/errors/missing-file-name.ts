import { CustomError, ERROR_CODES } from './custom-error';

export class MissingFileNameError extends CustomError {
  public constructor() {
    super('Filename is missing from test result', ERROR_CODES.MissingFileName);
  }
}
