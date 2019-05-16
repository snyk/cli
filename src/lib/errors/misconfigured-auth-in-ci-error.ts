import {CustomError} from './custom-error';

export function MisconfiguredAuthInCI() {
  const errorMsg = 'Web auth cannot be used whilst inside CI. You must include ' +
  'your API token as an environment value: `API=12345678`';

  const error = new CustomError(errorMsg);
  error.code = 401;
  error.strCode = 'noAuthInCI';
  error.userMessage = errorMsg;
  return error;
}
