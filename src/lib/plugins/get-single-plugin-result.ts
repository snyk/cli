import plugins = require('.');
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';
import { snykHttpClient } from '../request/snyk-http-client';
import { PACKAGE_MANAGERS_FEATURE_FLAGS_MAP } from '../package-managers';
import * as types from './types';

export async function getSinglePluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  featureFlags: Set<string> = new Set<string>(),
  targetFile?: string,
): Promise<pluginApi.InspectResult> {
  let plugin: types.Plugin;
  if (
    options.packageManager &&
    featureFlags.has(PACKAGE_MANAGERS_FEATURE_FLAGS_MAP[options.packageManager])
  ) {
    plugin = plugins.loadPluginUnderFeatureFlag(options.packageManager);
  } else {
    plugin = plugins.loadPlugin(options.packageManager);
  }
  const moduleInfo = ModuleInfo(plugin, options.policy);
  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    targetFile || options.file,
    { ...options },
    snykHttpClient,
  );
  return inspectRes;
}
