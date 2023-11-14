import { CustomError } from '../../../errors/custom-error';

const messagePrefix = 'There was a problem running Code analysis';

export class CodeClientError extends CustomError {
  constructor(statusCode: number, statusText: string, additionalUserHelp = '') {
    super(statusText);
    this.code = statusCode;
    this.userMessage = `${messagePrefix}. ${additionalUserHelp}\nContact support if the problem persists.`;
  }
}

export class CodeClientErrorWithDetail extends CustomError {
  constructor(message: string, statusCode: number, detail: string) {
    super(message);
    this.code = statusCode;
    this.userMessage = `${messagePrefix}. ${detail}.`;
  }
}
