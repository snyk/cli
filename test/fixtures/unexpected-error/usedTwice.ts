import { callHandlingUnexpectedErrors } from '../../../src/lib/unexpected-error';

callHandlingUnexpectedErrors(async () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('firstCall')), 100)
  })
}, 2);

callHandlingUnexpectedErrors(async () => {
  Promise.reject(new Error('secondCall'));
}, 4);
