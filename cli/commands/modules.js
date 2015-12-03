var snyk = require('../../lib');
var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function (path, options) {
  if (!options) {
    options = {};
  }
  return snyk.modules(path || process.cwd()).then(function (modules) {

    var parent = '';
    if (modules.parent) {
      parent = modules.parent.full;
    }

    if (options.json) {
      return JSON.stringify(modules, '', 2);
    }

    return parent + Object.keys(modules.dependencies).map(function (key) {
      return modules.dependencies[key].full;
    }).join('\n');
  });
};