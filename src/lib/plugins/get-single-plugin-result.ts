import * as plugins from '.';
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';
import { snykHttpClient } from '../request/snyk-http-client';
import * as types from './types';
import { buildPluginOptions } from './build-plugin-options';
const { SHOW_MAVEN_BUILD_SCOPE, SHOW_NPM_SCOPE } = require('../feature-flags');

export async function getSinglePluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFile?: string,
  featureFlags: Set<string> = new Set<string>(),
): Promise<pluginApi.InspectResult> {
  const plugin: types.Plugin = plugins.loadPlugin(options.packageManager);
  const moduleInfo = ModuleInfo(plugin, options.policy);

  // Build final options with any ecosystem-specific configurations/flags injected
  const pluginOptions = await buildPluginOptions(options);

  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    targetFile || options.file,
    {
      ...pluginOptions,
      showMavenBuildScope: featureFlags.has(SHOW_MAVEN_BUILD_SCOPE),
      showNpmScope: featureFlags.has(SHOW_NPM_SCOPE),
    },
    snykHttpClient,
  );
  return inspectRes;
}
