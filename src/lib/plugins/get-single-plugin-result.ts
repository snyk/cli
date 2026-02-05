import plugins = require('.');
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';
import { snykHttpClient } from '../request/snyk-http-client';
import * as types from './types';
import { buildPluginOptions } from './build-plugin-options';

export async function getSinglePluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFile?: string,
): Promise<pluginApi.InspectResult> {
  const plugin: types.Plugin = plugins.loadPlugin(options.packageManager);
  const moduleInfo = ModuleInfo(plugin, options.policy);

  // Build final options with any ecosystem-specific configurations/flags injected
  const pluginOptions = await buildPluginOptions(options);

  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    targetFile || options.file,
    pluginOptions,
    snykHttpClient,
  );
  return inspectRes;
}
