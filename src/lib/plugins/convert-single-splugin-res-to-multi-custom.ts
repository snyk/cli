import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { MultiProjectResultCustom } from './get-multi-plugin-result';
import { SupportedPackageManagers } from '../package-managers';

export function convertSingleResultToMultiCustom(
  inspectRes: pluginApi.SinglePackageResult,
  packageManager?: SupportedPackageManagers,
): MultiProjectResultCustom {
  if (!inspectRes.package.targetFile && inspectRes.plugin) {
    inspectRes.package.targetFile = inspectRes.plugin.targetFile;
  }
  const { plugin, meta, package: depTree } = inspectRes;

  if (!depTree.targetFile && plugin) {
    depTree.targetFile = plugin.targetFile;
  }

  return {
    plugin,
    scannedProjects: [
      {
        depTree,
        meta,
        targetFile: plugin.targetFile,
        packageManager:
          (inspectRes.plugin.packageManager as SupportedPackageManagers) ||
          packageManager,
      },
    ],
  };
}
