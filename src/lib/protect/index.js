var protect = module.exports = {
  ignore: require('./ignore'),
  update: require('./update').update,
  install: require('./update').install,
  installDev: require('./update').installDev,
  patch: require('./patch'),
  patchesForPackage: require('./patches-for-package'),
  generatePolicy: generatePolicy,
};

var debug = require('debug')('snyk');
var _ = require('lodash');

function generatePolicy(policy, tasks, live, packageManager) {
  var promises = ['ignore', 'update', 'patch'].filter((task) => {
    return tasks[task].length;
  }).map((task) => {
    return protect[task](tasks[task], live, packageManager);
  });

  return Promise.all(promises).then((res) => {
    // we're squashing the arrays of arrays into a flat structure
    // with only non-false values
    var results = _.flattenDeep(res).filter(Boolean);

    // then we merge the configs together using the original config
    // as the baseline (this lets us retain the user's existing config)
    results.unshift(policy);
    var newPolicy = _.merge.apply(_, results);

    debug(JSON.stringify(newPolicy, '', 2));

    return newPolicy;
  });
}
