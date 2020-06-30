import chalk from 'chalk';
import { CustomError } from './custom-error';

export function NotSupportedIacFileError(atLocations: string[]) {
  const locationsStr = atLocations.join(', ');
  const errorMsg =
    'Not supported infrastructure as code target files in ' +
    locationsStr +
    '.\nPlease see our documentation for supported target files: ' +
    chalk.underline(
      'https://support.snyk.io/hc/en-us/articles/360006368877-Scan-and-fix-security-issues-in-your-Kubernetes-configuration-files',
    ) +
    ' and make sure you are in the right directory.';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}

export function IllegalIacFileError(atLocations: string[]): CustomError {
  const locationsStr = atLocations.join(', ');
  const errorMsg =
    'Illegal infrastructure as code target file ' +
    locationsStr +
    '.\nPlease see our documentation for supported target files: ' +
    chalk.underline(
      'https://support.snyk.io/hc/en-us/articles/360006368877-Scan-and-fix-security-issues-in-your-Kubernetes-configuration-files',
    ) +
    ' and make sure you are in the right directory.';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}
