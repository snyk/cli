import chalk from 'chalk';
import { CustomError } from './custom-error';
import { CLI } from '@snyk/error-catalog-nodejs-public';

export function NoSupportedManifestsFoundError(
  atLocations: string[],
): CustomError {
  const locationsStr = atLocations.join(', ');
  const errorMsg =
    'Could not detect supported target files in ' +
    locationsStr +
    '.\nPlease see our documentation for supported languages and ' +
    'target files: ' +
    chalk.underline('https://snyk.co/udVgQ') +
    ' and make sure you are in the right directory.';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  error.errorCatalog = new CLI.NoSupportedFilesFoundError('');
  return error;
}
