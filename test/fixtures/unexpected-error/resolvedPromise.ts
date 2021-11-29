import { callHandlingUnexpectedErrors } from '../../../src/lib/unexpected-error';

callHandlingUnexpectedErrors(async () => {
  console.log('Result: resolvedPromise')
}, 2);
