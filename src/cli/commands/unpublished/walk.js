module.exports = walk;

function walk(deps, filter) {
  return new Promise(((resolve) => {
    if (!deps) {

      return resolve([]);
    }

    if (deps.dependencies) {
      deps = deps.dependencies;
    }

    const promises = Object.keys(deps).map((name) => {
      return new Promise(((resolve) => {
        return resolve(filter(deps[name], name, deps));
      })).then((res) => {
        if (!res && deps[name] && deps[name].dep) {
          return walk(deps[name].dependencies, filter);
        }
      });
    });

    resolve(Promise.all(promises));
  }));
}
