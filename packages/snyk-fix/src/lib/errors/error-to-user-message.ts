import { CustomError } from './custom-error';
import { UnsupportedTypeError } from './unsupported-type-error';

export function convertErrorToUserMessage(error: CustomError): string {
  if (error instanceof UnsupportedTypeError) {
    return `${error.scanType} is not supported.`;
  }
  return error.message;
}
