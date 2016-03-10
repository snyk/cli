var protect = module.exports = {
  ignore: require('./ignore'),
  update: require('./update'),
  patch: require('./patch'),
  patchesForPackage: require('./patches-for-package'),
  generatePolicy: generatePolicy,
};

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var _ = require('lodash');

function generatePolicy(policy, tasks, live) {
  var promises = ['ignore', 'update', 'patch'].filter(function (task) {
    return tasks[task].length;
  }).map(function (task) {
    return protect[task](tasks[task], live);
  });

  return Promise.all(promises).then(function (res) {
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