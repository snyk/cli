import { CustomError } from './custom-error';

export class FailedToLoadPolicyError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_STRING_CODE = 'POLICY_LOAD_FAILED';
  private static ERROR_MESSAGE = 'Could not load policy file.';

  constructor() {
    super(FailedToLoadPolicyError.ERROR_MESSAGE);
    this.code = FailedToLoadPolicyError.ERROR_CODE;
    this.strCode = FailedToLoadPolicyError.ERROR_STRING_CODE;
    this.userMessage = FailedToLoadPolicyError.ERROR_MESSAGE;
  }
}
