import * as plugins from '.';
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';
import { snykHttpClient } from '../request/snyk-http-client';
import * as types from './types';
import { SHOW_MAVEN_BUILD_SCOPE } from '../feature-flag-gateway';

export async function getSinglePluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFile?: string,
  featureFlags: Set<string> = new Set<string>(),
): Promise<pluginApi.InspectResult> {
  const plugin: types.Plugin = plugins.loadPlugin(options.packageManager);
  const moduleInfo = ModuleInfo(plugin, options.policy);

  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    targetFile || options.file,
    {
      ...options,
      showMavenBuildScope: featureFlags.has(SHOW_MAVEN_BUILD_SCOPE),
    },
    snykHttpClient,
  );
  return inspectRes;
}
