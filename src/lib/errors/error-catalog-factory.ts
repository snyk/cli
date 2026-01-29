import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';

/**
 * Simple factory that creates error catalog instances based on status code
 * @param statusCode - HTTP status code
 * @param message - Error message (optional)
 * @returns ProblemError instance
 */
export function createErrorCatalogFromStatusCode(
  statusCode: number,
): ProblemError {
  const error = new CLI.GeneralCLIFailureError('');

  // Update error metadata
  error.metadata.status = statusCode;

  if (statusCode < 400) {
    error.metadata.level = 'warn';
  }

  return error;
}
