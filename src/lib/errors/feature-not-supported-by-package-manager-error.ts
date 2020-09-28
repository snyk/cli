import { CustomError } from './custom-error';
import { SupportedPackageManagers } from '../package-managers';

export class FeatureNotSupportedByPackageManagerError extends CustomError {
  constructor(
    feature: string,
    packageManager: SupportedPackageManagers,
    additionalUserHelp = '',
  ) {
    super(`Unsupported package manager ${packageManager} for ${feature}.`);
    this.code = 422;

    this.userMessage = `'${feature}' is not supported for package manager '${packageManager}'. ${additionalUserHelp}`;
  }
}
