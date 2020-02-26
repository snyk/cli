import { CustomError } from './custom-error';
import chalk from 'chalk';

const errorNpmMessage =
  '\nplease check that the version and name are correct. See more details on what is supported `snyk help`';
const errorRepositoryMessage =
  `\nplease try it on ${chalk.underline('`https://snyk.io/test/`')}` +
  '. See more details on what is supported `snyk help`';

export function FailedToGetVulnsFromUnavailableResource(
  root: string,
  statusCode: number,
): CustomError {
  const isRepository = root.startsWith('http' || 'https');
  const errorMsg = `Could not test ${root}, ${
    isRepository ? errorRepositoryMessage : errorNpmMessage
  }`;
  const error = new CustomError(errorMsg);
  error.code = statusCode;
  error.userMessage = errorMsg;
  return error;
}
