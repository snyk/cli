import { CLI, Snyk, ProblemError } from '@snyk/error-catalog-nodejs-public';

/**
 * Simple factory that creates error catalog instances based on status code
 * @param statusCode - HTTP status code
 * @param message - Error message (optional)
 * @returns ProblemError instance
 */
export function createErrorCatalogFromStatusCode(
  statusCode: number,
): ProblemError {
  // For 500 status codes, use Snyk.ServerError
  if (statusCode === 500) {
    return new Snyk.ServerError('');
  }

  // For all other status codes, create a GeneralCLIFailureError and update its status
  const error = new CLI.GeneralCLIFailureError('');

  // Update error metadata
  error.metadata.status = statusCode;

  if (statusCode < 400 && statusCode > 0) {
    error.metadata.level = 'warn';
  }

  return error;
}
