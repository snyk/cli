import { CustomError } from './custom-error';

export function TestLimitReachedError(
  errorMessage = 'Test limit reached!',
  errorCode = 429,
) {
  const error = new CustomError(errorMessage);
  error.code = errorCode;
  error.strCode = 'TEST_LIMIT_REACHED';
  error.userMessage = errorMessage;
  return error;
}
