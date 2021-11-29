import { callHandlingUnexpectedErrors } from '../../../src/lib/unexpected-error';

callHandlingUnexpectedErrors(async () => {
  setTimeout(() => {
    throw new Error('uncaughtException');
  }, 100);
}, 2);
