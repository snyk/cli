import { CustomError } from './custom-error';

export class SarifFileOutputEmptyError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_MESSAGE =
    'Empty --sarif-file-output argument. Did you mean --file=path/to/output-file.json ?';

  constructor() {
    super(SarifFileOutputEmptyError.ERROR_MESSAGE);
    this.code = SarifFileOutputEmptyError.ERROR_CODE;
    this.userMessage = SarifFileOutputEmptyError.ERROR_MESSAGE;
  }
}
