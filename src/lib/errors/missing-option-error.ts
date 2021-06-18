import { CustomError } from './custom-error';

export class MissingOptionError extends CustomError {
  constructor(option: string, required: string[]) {
    const msg = `The ${option} option can only be use in combination with ${required
      .sort()
      .join(' or ')}.`;
    super(msg);
    this.code = 422;
    this.userMessage = msg;
  }
}
