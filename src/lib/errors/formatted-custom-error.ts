import chalk from 'chalk';
import { CustomError } from '.';
import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';

export class FormattedCustomError extends CustomError {
  public formattedUserMessage: string;

  constructor(
    message: string,
    formattedUserMessage: string,
    userMessage?: string,
    errorCatalog?: ProblemError,
  ) {
    super(message);
    this.userMessage = userMessage || chalk.reset(formattedUserMessage);
    this.formattedUserMessage = formattedUserMessage;
    this.errorCatalog = errorCatalog ?? new CLI.GeneralCLIFailureError('');
  }

  set errorCatalog(ec: ProblemError | undefined) {
    super.errorCatalog = ec;
  }

  get errorCatalog(): ProblemError | undefined {
    return this._errorCatalog;
  }
}
