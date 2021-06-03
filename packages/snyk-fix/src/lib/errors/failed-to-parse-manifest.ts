import { CustomError, ERROR_CODES } from './custom-error';

export class FailedToParseManifest extends CustomError {
  public constructor() {
    super('Failed to parse manifest', ERROR_CODES.FailedToParseManifest);
  }
}
