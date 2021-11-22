import { errorMessageWithRetry } from '../errors';

export function summariseErrorResults(errorResultsLength: number): string {
  const projects = errorResultsLength > 1 ? 'projects' : 'project';
  if (errorResultsLength > 0) {
    return errorMessageWithRetry(
      ` Failed to test ${errorResultsLength} ${projects}.`,
    );
  }

  return '';
}
