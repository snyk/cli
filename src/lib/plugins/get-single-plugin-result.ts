import plugins = require('.');
import { ModuleInfo } from '../module-info';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { TestOptions, Options, MonitorOptions } from '../types';

const SCAN_RESULTS_STUB = [
  {
    type: 'node',
    version: '1.0.0',
    data: {
      path: '/srv/app/package-lock.json',
      dependencies: {
        debug: {
          labels: {
            scope: 'prod',
          },
          dependencies: {
            ms: {
              labels: {
                scope: 'prod',
              },
              name: 'ms',
              version: '2.0.0',
            },
          },
          name: 'debug',
          version: '2.6.9',
        },
        shared: {
          labels: {
            scope: 'prod',
          },
          name: 'shared',
          version: '3.4.5',
        },
        marked: {
          name: 'marked',
          version: '0.3.5',
        },
      },
      hasDevDependencies: false,
      name: 'package-lock.json',
      size: 4,
      version: '0.0.1',
    },
  },
  {
    type: 'java',
    version: '1.0.0',
    data: [
      {
        path: '/var/lib/container/jwebmp-easing-effects-1.0.6.5.jar',
        hashType: 'sha1',
        hash: '6b56e3bbcb40f8506addb1b597fd4731ac5a9d9d',
      },
      {
        path: '/var/lib/container/maven-jar-plugin-3.2.0.jar',
        hashType: 'sha1',
        hash: '3d0c701677e8be0065ab7cbef023d04793a3a1fe',
      },
    ],
  },
];

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

  if (pluginApi.isMultiResult(inspectRes)) {
    for (const x of inspectRes.scannedProjects) {
      x.scanResults = SCAN_RESULTS_STUB;
    }
  } else {
    inspectRes.scanResults = SCAN_RESULTS_STUB;
  }
  return inspectRes;
}
