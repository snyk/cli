import { CLI } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from './custom-error';

export class InvalidDetectionDepthValue extends CustomError {
  constructor() {
    const msg = `Unsupported value for --detection-depth flag. Expected a positive integer.`;
    super(msg);
    this.code = 422;
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}
