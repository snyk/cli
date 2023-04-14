import { CustomError } from './custom-error';

export class CyclonedxJsonFileOutputBadInputError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_MESSAGE =
    'Empty --cyclonedx-json-file-output argument. Did you mean --cyclonedx-json-file-output=path/to/output-file.json ?';

  constructor() {
    super(CyclonedxJsonFileOutputBadInputError.ERROR_MESSAGE);
    this.code = CyclonedxJsonFileOutputBadInputError.ERROR_CODE;
    this.userMessage = CyclonedxJsonFileOutputBadInputError.ERROR_MESSAGE;
  }
}
