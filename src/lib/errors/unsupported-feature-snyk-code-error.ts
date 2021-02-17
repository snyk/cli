import { CustomError } from './custom-error';

export class FeatureNotSupportedBySnykCodeError extends CustomError {
  public readonly feature: string;

  constructor(feature: string, additionalUserHelp = '') {
    super(`Unsupported action for ${feature}.`);
    this.code = 422;
    this.feature = feature;

    this.userMessage = `'${feature}' is not supported for snyk code. ${additionalUserHelp}`;
  }
}
