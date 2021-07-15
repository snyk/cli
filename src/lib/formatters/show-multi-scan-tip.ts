import { SupportedPackageManagers } from '../package-managers';
import { Options, SupportedProjectTypes, TestOptions } from '../types';

import { showAllProjectsTip } from './show-all-projects-tip';
import { showGradleSubProjectsTip } from './show-all-sub-projects-tip';

export function showMultiScanTip(
  projectType: SupportedProjectTypes | SupportedPackageManagers,
  options: Options & TestOptions,
  foundProjectCount?: number,
): string {
  const gradleSubProjectsTip = showGradleSubProjectsTip(
    projectType,
    options,
    foundProjectCount,
  );
  if (gradleSubProjectsTip) {
    return gradleSubProjectsTip;
  }
  const allProjectsTip = showAllProjectsTip(
    projectType,
    options,
    foundProjectCount,
  );
  if (allProjectsTip) {
    return allProjectsTip;
  }
  return '';
}
