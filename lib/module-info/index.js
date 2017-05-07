module.exports = ModuleInfo;

function ModuleInfo (plugin, policy) {
  return {
    inspect: function (root, targetFile, pluginArgs) {
      return plugin
      .inspect(root, targetFile, pluginArgs)
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
