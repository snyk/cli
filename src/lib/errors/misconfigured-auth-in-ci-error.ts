import { CustomError } from './custom-error';

export class MisconfiguredAuthInCI extends CustomError {
  private static ERROR_CODE = 401;
  private static ERROR_STRING_CODE = 'noAuthInCI';
  private static ERROR_MESSAGE =
    '`snyk` requires an authenticated account. Provide your Snyk API token using a "SNYK_TOKEN" environment variable.';

  constructor() {
    super(MisconfiguredAuthInCI.ERROR_MESSAGE);
    this.code = MisconfiguredAuthInCI.ERROR_CODE;
    this.strCode = MisconfiguredAuthInCI.ERROR_STRING_CODE;
    this.userMessage = MisconfiguredAuthInCI.ERROR_MESSAGE;
  }
}
