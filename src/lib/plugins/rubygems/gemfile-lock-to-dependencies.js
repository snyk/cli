const gemfile = require('@snyk/gemfile');

module.exports = gemfileLockToDependencies;

const detectCycles = (dep, chain) => {
  if (chain.indexOf(dep) >= 0) {
    const error = Error('Cyclic dependency detected in lockfile');
    const UNPROCESSABLE_ENTITY = 422;
    error.code = UNPROCESSABLE_ENTITY;
    error.meta = { dep, chain };
    throw error;
  }
};

const gemfileReducer = (lockFile, allDeps, ancestors) => (deps, dep) => {
  const gemspec = lockFile.specs[dep];
  // If for some reason a dependency isn't included in the specs then its
  // better to just ignore it (otherwise all processing fails).
  // This happens for bundler itself, it isn't included in the Gemfile.lock
  // specs, even if its a dependency! (and that isn't documented anywhere)
  if (gemspec) {
    detectCycles(dep, ancestors);
    if (allDeps.has(dep)) {
      deps[dep] = allDeps.get(dep);
    } else {
      deps[dep] = {
        name: dep,
        version: gemspec.version,
      };
      allDeps.set(dep, deps[dep]);
      deps[dep].dependencies = Object.keys(gemspec)
        .filter((k) => k !== 'version')
        .reduce(gemfileReducer(lockFile, allDeps, ancestors.concat([dep])), {});
    }
  }
  return deps;
};

function gemfileLockToDependencies(fileContents) {
  const lockFile = gemfile.interpret(fileContents, true);

  return (
    Object.keys(lockFile.dependencies || {})
      // this is required to sanitise git deps with no exact version
      // listed as `rspec!`
      .map((dep) => dep.match(/[^!]+/)[0])
      .reduce(gemfileReducer(lockFile, new Map(), []), {})
  );
}
