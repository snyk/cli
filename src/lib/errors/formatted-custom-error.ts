import chalk from 'chalk';
import { CustomError } from '.';

export class FormattedCustomError extends CustomError {
  public formattedUserMessage: string;

  constructor(
    message: string,
    formattedUserMessage: string,
    userMessage?: string,
  ) {
    super(message);
    this.userMessage = userMessage || chalk.reset(formattedUserMessage);
    this.formattedUserMessage = formattedUserMessage;
  }
}
