import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from '../../test/iac/local-execution/error-utils';
import { IaCErrorCodes } from '../../test/iac/local-execution/types';

export class UnsupportedReportCommandError extends CustomError {
  constructor(message?: string) {
    super(message || 'Command "report" is only supported for IaC');
    this.code = IaCErrorCodes.UnsupportedReportCommandError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      '"report" is not a supported command. Did you mean to use "iac report"?';
  }
}
