var _ = require('lodash');
const debug = require('debug')('snyk');

module.exports = ModuleInfo;

function ModuleInfo(plugin, policy) {
  return {
    inspect: async function (root, targetFile, options) {
      var pluginOptions = _.merge({
        args: options._doubleDashArgs,
      }, options);

      debug('calling plugin inspect()', {root, targetFile, pluginOptions});
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
