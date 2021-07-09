import { isMultiProjectScan } from '../is-multi-project-scan';

export function showGradleSubProjectsTip(
  packageManager,
  options,
  foundProjectCount,
): string {
  if (
    packageManager !== 'gradle' ||
    !foundProjectCount ||
    isMultiProjectScan(options) ||
    options.allSubProjects
  ) {
    return '';
  }

  return (
    `Tip: This project has multiple sub-projects (${foundProjectCount}), ` +
    'use --all-sub-projects flag to scan all sub-projects.'
  );
}
