import plugins = require('.');
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';

export async function getSinglePluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFile?: string,
): Promise<pluginApi.InspectResult> {
  const plugin = plugins.loadPlugin(options.packageManager, options);
  const moduleInfo = ModuleInfo(plugin, options.policy);
  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    targetFile || options.file,
    { ...options },
  );
  return inspectRes;
}
