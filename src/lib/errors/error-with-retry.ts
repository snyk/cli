import { contactSupportMessage, reTryMessage } from '../common';

export function errorMessageWithRetry(message: string): string {
  return `${message}\n${reTryMessage}\n${contactSupportMessage}`;
}
