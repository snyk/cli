import chalk from 'chalk';
import { CustomError } from './custom-error';

export function NoSupportedManifestsFoundError(atLocations: string[]) {
  const locationsStr = atLocations.join(', ');
  const errorMsg =
    'Could not detect supported target files in ' +
    locationsStr +
    '.\nPlease see our documentation for supported languages and ' +
    'target files: ' +
    chalk.underline(
      'https://support.snyk.io/hc/en-us/articles/360000911957-Language-support',
    ) +
    ' and make sure you are in the right directory.';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}
