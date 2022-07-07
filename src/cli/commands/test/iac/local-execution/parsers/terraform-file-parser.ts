import { IaCErrorCodes } from '../types';
import { CustomError } from '../../../../../../lib/errors';
import { getErrorStringCode } from '../error-utils';

export class FailedToParseTerraformFileError extends CustomError {
  public filename: string;
  constructor(filename: string) {
    super('Failed to parse Terraform file');
    this.code = IaCErrorCodes.FailedToParseTerraformFileError;
    this.strCode = getErrorStringCode(this.code);
    this.filename = filename;
    this.userMessage = `We were unable to parse the Terraform file "${filename}", please ensure it is valid HCL2. This can be done by running it through the 'terraform validate' command.`;
  }
}
