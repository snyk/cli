import { CustomError, ERROR_CODES } from './custom-error';

export class MissingRemediationDataError extends CustomError {
  public constructor() {
    super(
      'Remediation data is required to apply fixes',
      ERROR_CODES.MissingRemediationData,
    );
  }
}
