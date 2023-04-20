import { CustomError } from '../../../errors/custom-error';

export class CodeClientError extends CustomError {
  constructor(
    statusCode: number,
    statusText: string,
    feature: string,
    additionalUserHelp = '',
  ) {
    super(statusText);
    this.code = statusCode;

    this.userMessage = `There was a problem running ${feature}. ${additionalUserHelp}\nPlease retry and contact support if the problem persists.`;
  }
}
