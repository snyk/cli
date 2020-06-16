import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { MultiProjectResultCustom } from './get-multi-plugin-result';
import { SupportedPackageManagers } from '../package-managers';

export function convertSingleResultToMultiCustom(
  inspectRes: pluginApi.SinglePackageResult,
  packageManager?: SupportedPackageManagers,
): MultiProjectResultCustom {
  if (!packageManager) {
    packageManager = inspectRes.plugin
      .packageManager as SupportedPackageManagers;
  }
  if (inspectRes.dependencyGraph) {
    return convertDepGraphResult(inspectRes, packageManager);
  } else {
    return convertDepTreeResult(inspectRes, packageManager);
  }
}

function convertDepGraphResult(
  inspectRes: pluginApi.SinglePackageResult,
  packageManager: SupportedPackageManagers,
): MultiProjectResultCustom {
  const { plugin, meta, dependencyGraph: depGraph, callGraph } = inspectRes;
  return {
    plugin,
    scannedProjects: [
      {
        plugin: plugin as any,
        depGraph,
        callGraph,
        meta,
        targetFile: plugin.targetFile,
        packageManager,
      },
    ],
  };
}

/**
 * @deprecated @boost: delete me when all languages uses depGraph
 */
function convertDepTreeResult(
  inspectRes: pluginApi.SinglePackageResult,
  packageManager: SupportedPackageManagers,
): MultiProjectResultCustom {
  if (
    inspectRes.package &&
    !inspectRes.package.targetFile &&
    inspectRes.plugin
  ) {
    inspectRes.package.targetFile = inspectRes.plugin.targetFile;
  }
  const { plugin, meta, package: depTree, callGraph } = inspectRes;

  if (depTree && !depTree.targetFile && plugin) {
    depTree.targetFile = plugin.targetFile;
  }

  return {
    plugin,
    scannedProjects: [
      {
        plugin: plugin as any,
        depTree,
        callGraph,
        meta,
        targetFile: plugin.targetFile,
        packageManager,
      },
    ],
  };
}
