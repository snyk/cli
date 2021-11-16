import { callHandlingUnexpectedErrors } from '../../../src/lib/unexpected-error';

callHandlingUnexpectedErrors(async () => {
  console.log('Result: firstCall')
}, 2);

callHandlingUnexpectedErrors(async () => {
  console.log('Result: secondCall')
}, 2);
