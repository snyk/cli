import {CustomError} from './custom-error';

export function TokenExpiredError() {
  const errorMsg = 'Sorry, but your authentication token has now' +
  ' expired.\nPlease try to authenticate again.';

  const error = new CustomError(errorMsg);
  error.code = 401;
  error.strCode = 'AUTH_TIMEOUT';
  error.userMessage = errorMsg;
  return error;
}
