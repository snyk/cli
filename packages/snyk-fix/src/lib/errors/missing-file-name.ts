import { CustomError, ERROR_CODES } from './custom-error';

export class MissingFileNameError extends CustomError {
  public constructor() {
    super(
      'Filename is missing from test result. Please contact support@snyk.io.',
      ERROR_CODES.MissingFileName,
    );
  }
}
