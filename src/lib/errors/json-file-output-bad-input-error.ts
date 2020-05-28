import { CustomError } from './custom-error';

export class JsonFileOutputBadInputError extends CustomError {
  private static ERROR_CODE = 422;
  private static ERROR_MESSAGE =
    'Empty --json-file-output argument. Did you mean --file=path/to/output-file.json ?';

  constructor() {
    super(JsonFileOutputBadInputError.ERROR_MESSAGE);
    this.code = JsonFileOutputBadInputError.ERROR_CODE;
    this.userMessage = JsonFileOutputBadInputError.ERROR_MESSAGE;
  }
}
