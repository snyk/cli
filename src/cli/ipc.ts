import { writeFile } from 'fs/promises';
import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';
import { debug as Debug } from 'debug';
import * as legacyErrors from '../lib/errors/legacy-errors';
import stripAnsi = require('strip-ansi');

const ERROR_FILE_PATH = process.env.SNYK_ERR_FILE;
const debug = Debug('snyk');

/**
 * Sends the specified error back at the Golang CLI, by writting it to the temporary error file. Errors that are not
 * inlcuded in the Error Catalog will be wraped in a generic model.
 * @param err {Error} The error to be sent to the Golang CLI
 * @returns {Promise<boolean>} The result of the operation as a boolean value
 */
export async function sendError(err: Error): Promise<boolean> {
  if (!ERROR_FILE_PATH) {
    debug('Error file path not set.');
    return false;
  }

  // @ts-expect-error Using this instead of 'instanceof' since the error might be caught from external CLI plugins.
  // See: https://github.com/snyk/error-catalog/blob/main/packages/error-catalog-nodejs/src/problem-error.ts#L17-L19
  if (!err.isErrorCatalogError) {
    const detail: string = stripAnsi(legacyErrors.message(err));
    if (!detail || detail.trim().length === 0) return false;

    err = new CLI.GeneralCLIFailureError(detail);
    // @ts-expect-error Overriding with specific err code from CustomErrors, or 0 for
    err.metadata.status = 0;
  }

  const data = (err as ProblemError)
    .toJsonApi('error-catalog-ipc-instance?')
    .body();

  try {
    await writeFile(ERROR_FILE_PATH, JSON.stringify(data));
  } catch (e) {
    debug('Failed to write data to error file: ', e);
    return false;
  }

  return true;
}
