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
  if (
    projectType === 'maven' &&
    foundProjectCount &&
    foundProjectCount > 1 &&
    !options.allProjects &&
    !options.mavenAggregateProject
  ) {
    return (
      'Tip: Detected Maven project, are you using modules? ' +
      'Use --maven-aggregate-project to scan each project. ' +
      'Alternatively use --all-projects to scan Maven and other types of projects.'
    );
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
