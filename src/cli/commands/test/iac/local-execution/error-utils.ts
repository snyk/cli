import { IaCErrorCodes } from './types';

export function getErrorStringCode(code: number): string {
  const errorName = IaCErrorCodes[code];
  if (!errorName) {
    return 'INVALID_IAC_ERROR';
  }
  let result = errorName.replace(/([A-Z])/g, '_$1');
  if (result.charAt(0) === '_') {
    result = result.substring(1);
  }
  return result.toUpperCase();
}
