import { callHandlingUnexpectedErrors } from '../lib/unexpected-error';
import { EXIT_CODES } from './exit-codes';

/**
 * By using a dynamic import, we can add error handlers before evaluating any
 * further modules. This way, if a module has errors, it'll be caught and
 * handled as we expect.
 */
callHandlingUnexpectedErrors(async () => {
  const { main } = await import('./main');
  await main();
}, EXIT_CODES.ERROR);
