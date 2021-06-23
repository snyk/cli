import { CustomError, ERROR_CODES } from './custom-error';

export class UnsupportedTypeError extends CustomError {
  public scanType: string;

  public constructor(scanType: string) {
    super(
      'Provided scan type is not supported',
      ERROR_CODES.UnsupportedTypeError,
    );
    this.scanType = scanType;
  }
}
