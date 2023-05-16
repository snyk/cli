import { CustomError } from '../../../errors/custom-error';

export class CodeClientError extends CustomError {
  constructor(statusCode: number, statusText: string, additionalUserHelp = '') {
    super(statusText);
    this.code = statusCode;

    this.userMessage = `There was a problem running Code analysis. ${additionalUserHelp}\nContact support if the problem persists.`;
  }
}
