import {CustomError} from './custom-error';

export class TooManyVulnPaths extends CustomError {
  private static ERROR_CODE: number = 413;
  private static ERROR_STRING_CODE: string = 'TOO_MANY_VULN_PATHS';
  private static ERROR_MESSAGE: string = 'Too many vulnerable paths to process the project';

  constructor() {
    super(TooManyVulnPaths.ERROR_MESSAGE);
    this.code = TooManyVulnPaths.ERROR_CODE;
    this.strCode = TooManyVulnPaths.ERROR_STRING_CODE;
    this.userMessage = TooManyVulnPaths.ERROR_MESSAGE;
  }
}
