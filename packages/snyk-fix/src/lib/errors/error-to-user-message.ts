import { UnsupportedTypeError } from "./unsupported-type-error";

export function convertErrorToUserMessage(error) {
  const errorMessagePrefix = `Error ${error.code} (${error.name})`;
  if (error instanceof UnsupportedTypeError) {
    return `${errorMessagePrefix} ${error.scanType} is not supported.`;
  }

}
