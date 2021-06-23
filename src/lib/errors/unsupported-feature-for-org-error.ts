import { CustomError } from './custom-error';

export class FeatureNotSupportedForOrgError extends CustomError {
  public readonly org: string;

  constructor(org: string, additionalUserHelp = '') {
    super(`Unsupported action for org ${org}.`);
    this.code = 422;
    this.org = org;

    this.userMessage = `Feature is not supported for org ${org}. ${additionalUserHelp}`;
  }
}
