module.exports = prune;

function prune(pkg, shouldPrune) {
  let remove = shouldPrune(pkg);
  if (!remove) {
    pkg.dependencies = {};
  }

  const deps = Object.keys(pkg.dependencies || {});

  if (deps.length) {
    remove = deps.filter((name) => {
      if (prune(pkg.dependencies[name], shouldPrune)) {
        delete pkg.dependencies[name];
        return false;
      }
      return true;
    }).length;
    remove = remove === 0;
  }

  return remove;
}
