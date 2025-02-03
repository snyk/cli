import { OpenAPI } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';

export class FeatureNotSupportedForOrgError extends CustomError {
  public readonly org: string;

  constructor(org: string, feature = 'Feature', additionalUserHelp = '') {
    super(`Unsupported action for org ${org}.`);
    this.code = 422;
    this.org = org;
    this.userMessage =
      `${feature} is not supported for org` +
      (org ? ` ${org}` : '') +
      (additionalUserHelp ? `: ${additionalUserHelp}` : '.');
    this.errorCatalog = new OpenAPI.ForbiddenError('');
  }
}
