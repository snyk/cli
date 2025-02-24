import { CLI } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';

export function MissingTargetFileError(path: string) {
  const errorMsg =
    `Not a recognised option did you mean --file=${path}? ` +
    'Check other options by running snyk --help';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  error.errorCatalog = new CLI.CommandArgsError('');
  return error;
}
