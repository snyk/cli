import { callHandlingUnexpectedErrors } from '../../../src/lib/unexpected-error';

callHandlingUnexpectedErrors(async () => {
  Promise.reject(new Error('unhandledRejection'));
}, 2);
