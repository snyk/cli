var snyk = require('../../lib');
var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function (path) {
  return snyk.modules(path || process.cwd()).then(function (modules) {

    var parent = '';
    if (modules.parent) {
      parent = modules.parent.full;
    }

    return parent + Object.keys(modules.dependencies).map(function (key) {
      return modules.dependencies[key].full;
    }).join('\n');
  });
};