import { CustomError } from './custom-error';

export class FailedToGetVulnerabilitiesError extends CustomError {
  private static ERROR_CODE = 500;
  private static ERROR_STRING_CODE = 'INTERNAL_SERVER_ERROR';
  private static ERROR_MESSAGE = 'Failed to get vulns';

  constructor(userMessage, statusCode) {
    super(FailedToGetVulnerabilitiesError.ERROR_MESSAGE);
    this.code = statusCode || FailedToGetVulnerabilitiesError.ERROR_CODE;
    this.strCode = FailedToGetVulnerabilitiesError.ERROR_STRING_CODE;
    this.userMessage =
      userMessage || FailedToGetVulnerabilitiesError.ERROR_MESSAGE;
  }
}
