export class CustomError extends Error {
  public innerError?: Error;
  public errorCode: string;

  public constructor(message: string, errorCode: ERROR_CODES) {
    super(message);
    this.name = this.constructor.name;
    this.innerError = undefined;
    this.errorCode = errorCode;
  }
}

export enum ERROR_CODES {
  UnsupportedTypeError = 'G1',
}
