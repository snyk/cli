import { isMultiProjectScan } from '../is-multi-project-scan';

export function showAllProjectsTip(
  packageManager,
  options,
  foundProjectCount,
): string {
  if (
    packageManager === 'gradle' ||
    !foundProjectCount ||
    isMultiProjectScan(options)
  ) {
    return '';
  }
  return (
    `Tip: Detected multiple supported manifests (${foundProjectCount}), ` +
    'use --all-projects to scan all of them at once.'
  );
}
