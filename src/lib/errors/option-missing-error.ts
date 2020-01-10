import { CustomError } from './custom-error';

export class OptionMissingErrorError extends CustomError {
  constructor(option: string, required: string) {
    const msg = `The ${option} option can only be use in combination with ${required}.`;
    super(msg);
    this.code = 422;
    this.userMessage = msg;
  }
}
