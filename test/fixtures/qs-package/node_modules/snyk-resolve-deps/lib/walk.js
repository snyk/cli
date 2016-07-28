module.exports = walk;

function walk(deps, filter) {
  if (!deps) {
    return [];
  }

  if (deps.dependencies) {
    deps = deps.dependencies;
  }

  Object.keys(deps).forEach(function (name) {
    var res = filter(deps[name], name, deps);
    if (!res && deps[name] && deps[name].dep) {
      walk(deps[name].dependencies, filter);
    }
  });
}
