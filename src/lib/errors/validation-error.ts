import { CustomError } from './custom-error';

export class ValidationError extends CustomError {
  constructor(message: string) {
    super(message);
    this.userMessage = message;
  }
}
