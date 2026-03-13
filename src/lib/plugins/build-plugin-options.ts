import { Options, TestOptions, MonitorOptions } from '../types';
import {
  DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
  INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
} from '../package-managers';

/**
 * Returns a shallow clone of the original `options` object with any
 * plugin-specific configuration injected.
 */
export async function buildPluginOptions(
  options: Options & (TestOptions | MonitorOptions),
  featureFlags: Set<string> = new Set<string>(),
): Promise<Options & (TestOptions | MonitorOptions)> {
  const pluginOptions: any = { ...options };

  const isGoPackageManager =
    options.packageManager === 'gomodules' ||
    options.packageManager === 'golangdep';

  if (isGoPackageManager) {
    pluginOptions.configuration = {
      ...(pluginOptions.configuration || {}),
      includeGoStandardLibraryDeps: featureFlags.has(
        INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
      ),
      includePackageUrls: !featureFlags.has(
        DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
      ),
      // enable fix for replaced modules.
      useReplaceName: true,
    } as Options['configuration'];
  }

  return pluginOptions;
}
