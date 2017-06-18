module.exports = ModuleInfo;

function ModuleInfo (plugin, policy) {
  return {
    inspect: function (root, targetFile, options) {
      var pluginOptions = Object.assign({
        args: options._doubleDashArgs,
      }, options);
      return plugin
      .inspect(root, targetFile, pluginOptions)
      .then(function (info) {
        // attach policy if not provided by plugin
        if (policy && !info.package.policy) {
          info.package.policy = policy.toString();
        }
        return info;
      });
    },
  };
}
