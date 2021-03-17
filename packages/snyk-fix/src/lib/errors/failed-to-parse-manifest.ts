import { CustomError, ERROR_CODES } from './custom-error';

export class FailedToParseManifest extends CustomError {
  public constructor() {
    super(
      'Failed to parse manifest. Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>',
      ERROR_CODES.FailedToParseManifest,
    );
  }
}
