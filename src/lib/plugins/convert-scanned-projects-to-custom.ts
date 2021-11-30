import cliInterface from '@snyk/cli-interface';
import { ScannedProjectCustom } from './get-multi-plugin-result';
import { SupportedPackageManagers } from '../package-managers';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';

export function convertScannedProjectsToCustom(
  scannedProjects: cliInterface.legacyCommon.ScannedProject[],
  pluginMeta: PluginMetadata,
  packageManager?: SupportedPackageManagers,
  targetFile?: string,
): ScannedProjectCustom[] {
  // annotate the package manager & targetFile to be used
  // for test & monitor
  return scannedProjects.map((a) => {
    (a as ScannedProjectCustom).plugin =
      (a as ScannedProjectCustom).plugin || pluginMeta;
    (a as ScannedProjectCustom).targetFile = a.targetFile || targetFile;
    (a as ScannedProjectCustom).packageManager = (a as ScannedProjectCustom)
      .packageManager
      ? (a as ScannedProjectCustom).packageManager
      : (packageManager as SupportedPackageManagers);
    (a as ScannedProjectCustom).meta = a.meta;
    return a as ScannedProjectCustom;
  });
}
