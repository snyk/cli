import { CustomError } from './custom-error';

export class CommandNotSupportedError extends CustomError {
  public readonly command: string;
  public readonly org?: string;

  constructor(command: string, org?: string) {
    super(`${command} is not supported for org ${org}.`);
    this.code = 422;
    this.command = command;
    this.org = org;

    this.userMessage = `\`${command}\` is not supported ${
      org ? `for org '${org}'` : ''
    }`;
  }
}
