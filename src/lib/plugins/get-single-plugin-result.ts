import plugins = require('.');
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options } from '../types';

export async function getSinglePluginResult(
  root: string,
  options: Options & TestOptions,
): Promise<pluginApi.InspectResult> {
  const plugin = plugins.loadPlugin(options.packageManager, options);
  const moduleInfo = ModuleInfo(plugin, options.policy);
  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    options.file,
    { ...options },
  );
  return inspectRes;
}
