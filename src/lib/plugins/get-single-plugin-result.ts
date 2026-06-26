import * as plugins from '.';
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';
import { snykHttpClient } from '../request/snyk-http-client';
import * as types from './types';
import { buildPluginOptions } from './build-plugin-options';
import {
  SHOW_MAVEN_BUILD_SCOPE,
  SHOW_NPM_SCOPE,
  CLI_DOTNET_RUNTIME_RESOLUTION,
} from '../feature-flags';

export async function getSinglePluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFile?: string,
  featureFlags: Set<string> = new Set<string>(),
): Promise<pluginApi.InspectResult> {
  const plugin: types.Plugin = plugins.loadPlugin(options.packageManager);
  const moduleInfo = ModuleInfo(plugin, options.policy);

  // Build final options with any ecosystem-specific configurations/flags injected
  const pluginOptions = await buildPluginOptions(options, featureFlags);

  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    targetFile || options.file,
    {
      ...pluginOptions,
      showMavenBuildScope: featureFlags.has(SHOW_MAVEN_BUILD_SCOPE),
      showNpmScope: featureFlags.has(SHOW_NPM_SCOPE),
      cliDotnetRuntimeResolutionEnabled: featureFlags.has(
        CLI_DOTNET_RUNTIME_RESOLUTION,
      ),
      // Internal/undocumented flag: surfaced to the plugin in camelCase here
      // rather than via the user-facing arg transform list, so it stays off the
      // documented CLI surface. Single convergence point for single- and
      // multi-project (all-projects/aggregate) scans. Only added when set so the
      // default plugin-options shape is unchanged (the flag is gateway-driven
      // and absent for the vast majority of scans).
      ...(options['include-component-metadata'] !== undefined && {
        includeComponentMetadata: options['include-component-metadata'],
      }),
    },
    snykHttpClient,
  );
  return inspectRes;
}
