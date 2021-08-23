import chalk from 'chalk';
import { CustomError } from './custom-error';

export class NoSupportedSastFiles extends CustomError {
  private static ERROR_MESSAGE =
    'We found 0 supported files ' +
    '\nPlease see our documentation for Snyk Code language and framework support\n' +
    chalk.underline(
      'https://support.snyk.io/hc/en-us/articles/360016973477-Snyk-Code-language-support',
    );

  constructor() {
    super(NoSupportedSastFiles.ERROR_MESSAGE);
    this.code = 422;
    this.userMessage = NoSupportedSastFiles.ERROR_MESSAGE;
  }
}
