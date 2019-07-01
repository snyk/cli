import * as _ from 'lodash';
import * as Debug from 'debug';
import {
  Plugin, InspectOptions, isMultiResult, SingleSubprojectPlugin,
} from '@snyk/cli-interface/dist/legacy/plugin';
import { ArgsOptions } from '../../cli/args';

const debug = Debug('snyk-module-info');

export function ModuleInfo(plugin: Plugin | SingleSubprojectPlugin, policy) {
  return {
    async inspect(root: string, targetFile: string | undefined, options: ArgsOptions & InspectOptions) {
      const pluginOptions = _.merge({
        args: (options as ArgsOptions)._doubleDashArgs,
      }, options);

      debug('calling plugin inspect()', {root, targetFile, pluginOptions});
      const info = await plugin.inspect(root, targetFile, pluginOptions);
      debug('plugin inspect() done');

      // attach policy if not provided by plugin

      if (policy && !isMultiResult(info) && !(info.package.policy)) {
        info.package.policy = policy.toString();
      }

      if (policy && isMultiResult(info)) {
        throw new Error('Applying policy to multiple sub-project scans is not yet supported');
      }

      return info;
    },
  };
}
