import {CustomError} from './custom-error';

export function MisconfiguredAuthInCI() {
  const errorMsg = 'Snyk is missing auth token in order to run inside CI. You must include ' +
  'your API token as an environment value: `SNYK_TOKEN=12345678`';

  const error = new CustomError(errorMsg);
  error.code = 401;
  error.strCode = 'noAuthInCI';
  error.userMessage = errorMsg;
  return error;
}
