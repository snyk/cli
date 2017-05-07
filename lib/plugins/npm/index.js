var Promise = require('es6-promise').Promise; // jshint ignore:line
var snyk = require('../../');

module.exports = {
  inspect: inspect,
};

function inspect(root) {
  return snyk.modules(root)
  .then(function (modules) {
    return {
      plugin: {
        name: 'snyk-resolve-deps',
        runtime: process.version,
      },
      package: modules,
    };
  });
}
