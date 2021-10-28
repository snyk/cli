import { CustomError } from './custom-error';

export class UnsupportedFeatureFlagError extends CustomError {
  public readonly featureFlag: string;
  private static ERROR_CODE = 403;

  constructor(
    featureFlag: string,
    userMessage = `Feature flag '${featureFlag}' is not currently enabled for your org, to enable please contact snyk support`,
  ) {
    super(userMessage);
    this.featureFlag = featureFlag;
    this.userMessage = userMessage;
    this.code = UnsupportedFeatureFlagError.ERROR_CODE;
  }
}
