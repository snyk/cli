import { CustomError } from './custom-error';
import * as pms from '../package-managers';

export class UnsupportedPackageManagerError extends CustomError {
  private static ERROR_MESSAGE: string =
    'Here are our supported package managers:' +
    `${Object.keys(pms.SUPPORTED_PACKAGE_MANAGER_NAME).map(
      (i) => '\n  - ' + i + ' (' + pms.SUPPORTED_PACKAGE_MANAGER_NAME[i] + ')',
    )}
        `;

  constructor(packageManager) {
    super(
      `Unsupported package manager ${packageManager}.` +
        UnsupportedPackageManagerError.ERROR_MESSAGE,
    );
    this.code = 422;
    this.userMessage =
      `Unsupported package manager '${packageManager}''. ` +
      UnsupportedPackageManagerError.ERROR_MESSAGE;
  }
}
