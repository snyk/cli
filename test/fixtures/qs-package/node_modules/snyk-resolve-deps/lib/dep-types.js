// Dependency types.
// We don't call out all of them, only the ones relevant to our behavior.
// extraneous means not found in package.json files, prod means not dev ATM
var depTypes = module.exports = function (depName, pkg) {
  var type = null;
  var from = 'unknown';

  if (pkg.devDependencies && pkg.devDependencies[depName]) {
    type = depTypes.DEV;
    from = pkg.devDependencies[depName];
  }

  if (pkg.optionalDependencies && pkg.optionalDependencies[depName]) {
    type = depTypes.OPTIONAL;
    from = pkg.optionalDependencies[depName];
  }

  // production deps trump all
  if (pkg.dependencies && pkg.dependencies[depName]) {
    type = depTypes.PROD;
    from = pkg.dependencies[depName];
  }

  var bundled = !!(pkg.bundleDependencies &&
    pkg.bundleDependencies.indexOf(depName) !== -1);

  return {
    type: type,
    from: from,
    bundled: bundled,
  };
};

module.exports.EXTRANEOUS = 'extraneous';
module.exports.OPTIONAL = 'optional';
module.exports.PROD = 'prod';
module.exports.DEV = 'dev';
