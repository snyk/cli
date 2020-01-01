import * as cliInterface from '@snyk/cli-interface';
import { ScannedProjectCustom } from './get-multi-plugin-result';
import { SupportedPackageManagers } from '../package-managers';

export function convertScannedProjectsToCustom(
  scannedProjects: cliInterface.legacyCommon.ScannedProject[],
  packageManager?: SupportedPackageManagers,
  targetFile?: string,
): ScannedProjectCustom[] {
  // annotate the package manager & targetFile to be used
  // for test & monitor
  return scannedProjects.map((a) => {
    (a as ScannedProjectCustom).targetFile = a.targetFile || targetFile;
    (a as ScannedProjectCustom).packageManager = (a as ScannedProjectCustom)
      .packageManager
      ? (a as ScannedProjectCustom).packageManager
      : (packageManager as SupportedPackageManagers);
    return a as ScannedProjectCustom;
  });
}
