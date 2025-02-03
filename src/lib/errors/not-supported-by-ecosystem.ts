import { CustomError } from './custom-error';
import { SupportedPackageManagers } from '../package-managers';
import { Ecosystem } from '../ecosystems/types';
import { Fix } from '@snyk/error-catalog-nodejs-public';

export class FeatureNotSupportedByEcosystemError extends CustomError {
  public readonly feature: string;

  constructor(
    feature: string,
    ecosystem: SupportedPackageManagers | Ecosystem,
  ) {
    super(`Unsupported ecosystem ${ecosystem} for ${feature}.`);
    this.code = 422;
    this.feature = feature;

    this.userMessage = `\`${feature}\` is not supported for ecosystem '${ecosystem}'`;
    this.errorCatalog = new Fix.UnsupportedEcosystemError('');
  }
}
