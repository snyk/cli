import { ProblemError } from '@snyk/error-catalog-nodejs-public';

export class CustomError extends Error {
  public innerError;
  public code: number | undefined;
  public userMessage: string | undefined;
  public strCode: string | undefined;
  protected _errorCatalog: ProblemError | undefined;

  constructor(message: string) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.code = undefined;
    this.strCode = undefined;
    this.innerError = undefined;
    this.userMessage = undefined;
    this._errorCatalog = undefined;
  }

  set errorCatalog(ec: ProblemError | undefined) {
    this._errorCatalog = ec;
  }

  get errorCatalog(): ProblemError | undefined {
    if (this._errorCatalog) {
      this._errorCatalog.detail = this.userMessage ?? this.message;
    }
    return this._errorCatalog;
  }
}
