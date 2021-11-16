import { callHandlingUnexpectedErrors } from '../../../src/lib/unexpected-error';

callHandlingUnexpectedErrors(async () => {
  throw new Error('rejectedPromise');
}, 2);
