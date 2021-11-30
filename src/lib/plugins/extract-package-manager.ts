import cliInterface from '@snyk/cli-interface';
import { ScannedProjectCustom } from './get-multi-plugin-result';
import { SupportedPackageManagers } from '../package-managers';

export function extractPackageManager(
  scannedProject: ScannedProjectCustom,
  pluginRes: cliInterface.legacyPlugin.MultiProjectResult,
  options: {
    packageManager?: SupportedPackageManagers;
  },
): SupportedPackageManagers | undefined {
  // try and use the package Manager from the plugin
  // result if present
  const packageManager =
    scannedProject.packageManager ||
    (pluginRes.plugin && pluginRes.plugin.packageManager);

  if (packageManager) {
    return packageManager;
  }

  if (!packageManager && options.packageManager) {
    // fallback to Options packageManager
    return options.packageManager;
  }

  // for example: docker
  return undefined;
}
