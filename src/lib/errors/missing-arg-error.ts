import { CustomError } from './custom-error';

export class MissingArgError extends CustomError {
  constructor() {
    const msg =
      'Could not detect an image. Specify an image name to scan and try running the command again.';
    super(msg);
    this.code = 422;
    this.userMessage = msg;
  }
}
