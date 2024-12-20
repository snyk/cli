import { writeFile } from 'fs/promises';
import { ProblemError } from '@snyk/error-catalog-nodejs-public';

// TODO: handle more gracefully
const ERROR_FILE_PATH = process.env.SNYK_ERR_FILE!;

export async function sendError(err: Error): Promise<void> {
  const data = serializeError(err);
  return await writeFile(ERROR_FILE_PATH, data);
}

// TBD: json format that the erorr get sent as (ProblemErrorJson, JSON API, custom one?)
function serializeError(err: Error): string {
  // @ts-expect-error Using this instead of 'instanceof' since the error might be caught from external CLI plugins.
  // See: https://github.com/snyk/error-catalog/blob/main/packages/error-catalog-nodejs/src/problem-error.ts#L17-L19
  if (err.isErrorCatalogError) {
    // NOTE: there's also the JSON API version for this.
    return JSON.stringify((err as ProblemError).toProblemJson('instance?'));
  }

  return JSON.stringify(err, Object.getOwnPropertyNames(err));
}
