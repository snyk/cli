import { Options, TestOptions, MonitorOptions } from '../types';
import { hasFeatureFlagOrDefault } from '../feature-flags';

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
    pluginOptions.configuration = {
      ...(pluginOptions.configuration || {}),
      includeGoStandardLibraryDeps: await hasFeatureFlagOrDefault(
        'includeGoStandardLibraryDeps',
        options,
        false,
      ),
    };
  }

  return pluginOptions;
}
