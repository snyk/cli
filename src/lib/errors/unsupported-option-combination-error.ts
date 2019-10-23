import { CustomError } from './custom-error';

export class UnsupportedOptionCombinationError extends CustomError {
  private static ERROR_MESSAGE =
    'The following option combination is not currently supported: ';

  constructor(options: string[]) {
    super(
      UnsupportedOptionCombinationError.ERROR_MESSAGE + JSON.stringify(options),
    );
    this.code = 422;
    this.userMessage =
      UnsupportedOptionCombinationError.ERROR_MESSAGE + JSON.stringify(options);
  }
}
