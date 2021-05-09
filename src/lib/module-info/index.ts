const merge = require('lodash.merge');
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';

const util = require('util');
const debug = util.debuglog('snyk-module-info');

export function ModuleInfo(plugin, policy) {
  return {
    async inspect(
      root,
      targetFile,
      options,
    ): Promise<pluginApi.SinglePackageResult | pluginApi.MultiProjectResult> {
      const pluginOptions = merge(
        {
          args: options._doubleDashArgs,
        },
        options,
      );

      debug('calling plugin inspect()', { root, targetFile, pluginOptions });
      const info = await plugin.inspect(root, targetFile, pluginOptions);
      debug('plugin inspect() done');

      // attach policy if not provided by plugin
      if (policy && !info.package.policy) {
        info.package.policy = policy.toString();
      }

      return info;
    },
  };
}
