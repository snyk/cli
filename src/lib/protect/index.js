const protect = module.exports = {
  ignore: require('./ignore'),
  update: require('./update').update,
  install: require('./update').install,
  installDev: require('./update').installDev,
  patch: require('./patch'),
  patchesForPackage: require('./patches-for-package'),
  generatePolicy: generatePolicy,
};

const debug = require('debug')('snyk');
const _ = require('lodash');

function generatePolicy(policy, tasks, live, packageManager) {
  const promises = ['ignore', 'update', 'patch'].filter((task) => {
    return tasks[task].length;
  }).map((task) => {
    return protect[task](tasks[task], live, packageManager);
  });

  return Promise.all(promises).then((res) => {
    // we're squashing the arrays of arrays into a flat structure
    // with only non-false values
    const results = _.flattenDeep(res).filter(Boolean);

    // then we merge the configs together using the original config
    // as the baseline (this lets us retain the user's existing config)
    results.unshift(policy);
    const newPolicy = _.merge(...results);

    debug(JSON.stringify(newPolicy, '', 2));

    return newPolicy;
  });
}
