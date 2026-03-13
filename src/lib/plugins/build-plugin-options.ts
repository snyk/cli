import { Options, TestOptions, MonitorOptions } from '../types';
import { hasFeatureFlagOrDefault } from '../feature-flags';
import { INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG } from '../package-managers';

/**
 * Returns a shallow clone of the original `options` object with any
 * plugin-specific configuration injected.
 */
export async function buildPluginOptions(
  options: Options & (TestOptions | MonitorOptions),
): Promise<Options & (TestOptions | MonitorOptions)> {
  const pluginOptions: any = { ...options };

  const isGoPackageManager =
    options.packageManager === 'gomodules' ||
    options.packageManager === 'golangdep';

  if (isGoPackageManager) {
    const includeGoStandardLibraryDeps =
      options.includeGoStandardLibraryDeps !== undefined
        ? options.includeGoStandardLibraryDeps
        : await hasFeatureFlagOrDefault(
            INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
            options,
            false,
          );

    const disableGoPackageUrls = await hasFeatureFlagOrDefault(
      'disableGoPackageUrlsInCli',
      options,
      false,
    );

    pluginOptions.configuration = {
      ...(pluginOptions.configuration || {}),
      includeGoStandardLibraryDeps,
      includePackageUrls: disableGoPackageUrls ? false : true,
      // enable fix for replaced modules.
      useReplaceName: true,
    } as Options['configuration'];
  }

  return pluginOptions;
}
