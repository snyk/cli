var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function error(command) {
  return Promise.reject(new Error('Unknown command "' + command + '"'));
};

module.exports.ECONNREFUSED = 'Failed to connect to remote resource';
module.exports['404'] = 'Unknown API endpoint';
module.exports.Unauthorized = 'Unauthorized: please ensure you are ' +
  'logged using `snyk login`';
module.exports.MISSING_DOTFILE = 'Cannot find .snyk in this ' +
  'project, make to create one with `snyk protect --interactive`';