import { sendError } from '../cli/ipc';
import Debug from 'debug';
const debug = Debug('snyk:unexpected-error');

/**
 * Ensures a given function does not throw any errors, including unexpected ones
 * outside of its chain of execution.
 *
 * This function can only be used once in the same process. If you have multiple
 * callables needing this, compose them into a single callable.
 */
export async function callHandlingUnexpectedErrors(
  callable: () => Promise<unknown>,
  exitCode: number,
): Promise<void> {
  function handleUnexpectedError(reason: unknown): never {
    let errorWasSend = false;

    const e = reason as Error;
    if (e !== undefined) {
      // in this case we create an extra error object to send, in order to ensure that we have as much information as possible displayed
      const tmp = new Error();
      tmp.message = e.stack === undefined ? e.message : e.stack;
      errorWasSend = sendError(tmp, false);
    }

    const code = (reason as any).exitCode ?? exitCode;
    if (!errorWasSend) {
      debug('Something unexpected went wrong:', reason);
      debug('Exit code:', code);
    }

    process.exit(code);
  }

  process.on('uncaughtException', handleUnexpectedError);

  /**
   * Since Node 15, 'unhandledRejection' without a handler causes an
   * 'uncaughtException'. However, we also support Node 14 (as of writing)
   * which doesn't have that behaviour. So we still need this handler for now.
   */
  process.on('unhandledRejection', handleUnexpectedError);

  try {
    await callable();
  } catch (e) {
    handleUnexpectedError(e);
  }

  /**
   * Do NOT remove any 'uncaughtException' and 'unhandledRejection' handlers.
   * It may seem like we should after callable has done its thing. However,
   * there's never a point when everything's "done". There's no guarantee that
   * a callable hasn't created a chain of execution outside of its chain which
   * might trigger an unexpected error.
   *
   * For example, we want to avoid this scenario:
   *
   * - Add Handler L for 'uncaughtException' and 'unhandledRejection'
   * - Call Function A
   * - Function A calls Function B, which returns Promise P.
   * - Function A does not await Promise P
   * - Function A returns.
   * - Remove Handler L. <- Don't do this! Otherwise...
   * - Some time passes...
   * - Promise P rejects.
   * - NodeJS has nothing left to execute.
   * - NodeJS gathers all unhandled rejected promises.
   * - There are no 'unhandledRejection' handlers.
   * - For Node 15 and above:
   *   - NodeJS triggers 'uncaughtException'
   *   - There are no 'uncaughtException' handlers.
   *   - NodeJS defaults to Exit Code 1. <- We want a different exit code.
   * - For Node 14 and below:
   *   - NodeJS logs a warning. <- We want the same behaviour across versions.
   */
}
