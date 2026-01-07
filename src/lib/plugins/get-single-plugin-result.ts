import plugins = require('.');
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';
import { snykHttpClient } from '../request/snyk-http-client';
import * as types from './types';

export async function getSinglePluginResult(
  root: string,
  options: Options & (TestOptions | MonitorOptions),
  targetFile?: string,
): Promise<pluginApi.InspectResult> {
  const debug = require('debug')('snyk');
  debug(`[UV-DEBUG] getSinglePluginResult called with root: ${root}, packageManager: ${options.packageManager}, targetFile: ${targetFile}, options.file: ${options.file}`);
  const plugin: types.Plugin = plugins.loadPlugin(options.packageManager);
  debug(`[UV-DEBUG] Plugin loaded: ${plugin ? 'plugin object exists' : 'null'}`);
  const moduleInfo = ModuleInfo(plugin, options.policy);
  debug(`[UV-DEBUG] Calling plugin.inspect with root: ${root}, targetFile: ${targetFile || options.file}`);
  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    targetFile || options.file,
    { ...options },
    snykHttpClient,
  );
  debug(`[UV-DEBUG] Plugin inspect completed`);
  return inspectRes;
}
