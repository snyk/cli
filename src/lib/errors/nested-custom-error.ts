import { CustomError } from './custom-error';

export class NestedCustomError extends CustomError {
  constructor(message: string, innerError?: any) {
    super(message);
    this.innerError = innerError;
  }

  public get nestedName(): string {
    return this.innerError?.nestedName || this.innerError?.name || this.name;
  }

  public get nestedStack(): string | undefined {
    const stackComponents: string[] = [];
    if (this.stack) {
      stackComponents.push(this.stack);
    }

    const nestedStack = this.innerError?.nestedStack || this.innerError?.stack;
    if (nestedStack) {
      stackComponents.push(nestedStack);
    }

    return stackComponents.join('\n' + ' '.repeat(2) + '[cause]: ');
  }

  public get nestedMessage(): string {
    let message = this.message;

    const innerErrorMessage =
      this.innerError?.nestedMessage || this.innerError?.message;
    if (innerErrorMessage) {
      message += '\nCaused by: ' + innerErrorMessage;
    }

    return message;
  }

  public get nestedUserMessage(): string | undefined {
    return (
      this.innerError?.nestedUserMessage ||
      this.innerError?.userMessage ||
      this.userMessage
    );
  }

  public get nestedCode(): number | undefined {
    return this.innerError?.nestedCode || this.innerError?.code || this.code;
  }

  public get nestedStrCode(): string | undefined {
    return (
      this.innerError?.nestedStrCode || this.innerError?.strCode || this.strCode
    );
  }

  public toString(): string {
    let errStr = `${this.name}: ${this.message}`;

    const nestedErrStr = this.innerError?.toString();
    if (nestedErrStr) {
      errStr += '\nCaused by: ' + nestedErrStr;
    }

    return errStr;
  }
}
