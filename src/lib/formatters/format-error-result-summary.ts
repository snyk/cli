export function summariseErrorResults(errorResultsLength: number): string {
  const projects = errorResultsLength > 1 ? 'projects' : 'project';
  if (errorResultsLength > 0) {
    return (
      ` Failed to test ${errorResultsLength} ${projects}.\n` +
      'Run with `-d` for debug output and contact support@snyk.io'
    );
  }

  return '';
}
