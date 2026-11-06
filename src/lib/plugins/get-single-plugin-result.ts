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

  // sbt must use the system proxy; other plugins may call Snyk APIs during inspect.
  // shortcut: process.env is shared; pass env to subprocesses if callers become concurrent.
  const proxyKeys =
    options.packageManager === 'sbt'
      ? ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
      : [];
  const saved: NodeJS.ProcessEnv = Object.fromEntries(
    proxyKeys.map((key) => [key, process.env[key]]),
  );
  for (const key of proxyKeys) {
    const systemProxy = process.env[`SNYK_SYSTEM_${key.toUpperCase()}`];
    if (systemProxy === undefined) continue;
    if (systemProxy) process.env[key] = systemProxy;
    else delete process.env[key];
  }
  const inspectPromise = moduleInfo.inspect(
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
      // documented CLI surface. Convergence point for single-project scans and
      // the non-workspace files of all-projects/aggregate scans; npm workspace
      // projects are handled earlier in getMultiPluginResult and forward the
      // flag themselves (workspaces are an npm-only concept). Only added when
      // set so the default plugin-options shape is unchanged (the flag is
      // gateway-driven and absent for the vast majority of scans).
      ...(options['include-component-metadata'] !== undefined && {
        includeComponentMetadata: options['include-component-metadata'],
      }),
      // Forwarded alongside include-component-metadata (see
      // cli-extension-dep-graph's legacy resolution path). The Gradle plugin
      // reads it to force --refresh-dependencies so distribution:url can be
      // resolved; ignored by other plugins. Only added when set to keep the
      // default plugin-options shape unchanged.
      //
      // This flag does nothing on its own: snyk-gradle-plugin only appends
      // --refresh-dependencies inside its includeComponentMetadata branch, so
      // without --include-component-metadata alongside it the scan is
      // unchanged.
      ...(options['gradle-refresh-dependencies'] !== undefined && {
        gradleRefreshDependencies: options['gradle-refresh-dependencies'],
      }),
    },
    snykHttpClient,
  );
  try {
    return await inspectPromise;
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
