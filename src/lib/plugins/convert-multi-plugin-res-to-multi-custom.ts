import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { MultiProjectResultCustom } from './get-multi-plugin-result';
import { convertScannedProjectsToCustom } from './convert-scanned-projects-to-custom';
import { SupportedPackageManagers } from '../package-managers';

export function convertMultiResultToMultiCustom(
  inspectRes: pluginApi.MultiProjectResult,
  packageManager?: SupportedPackageManagers,
  targetFile?: string,
): MultiProjectResultCustom {
  // convert all results from the same plugin to MultiProjectResultCustom
  // and annotate each scannedProject with packageManager
  return {
    plugin: inspectRes.plugin,
    scannedProjects: convertScannedProjectsToCustom(
      inspectRes.scannedProjects,
      (inspectRes.plugin.packageManager as SupportedPackageManagers) ||
        packageManager,
      targetFile,
    ),
  };
}
