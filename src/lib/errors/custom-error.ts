export class CustomError extends Error {
  public innerError;
  public code: number | undefined;
  public userMessage: string | undefined;
  public strCode: string | undefined;

  constructor(message: string) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.code = undefined;
    this.innerError = undefined;
    this.userMessage = undefined;
  }
}
