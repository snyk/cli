var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function error(command) {
  return Promise.reject(new Error('Unknown command "' + command + '"'));
};

module.exports.ECONNREFUSED = 'Failed to connect snyk.io';
module.exports['404'] = 'Unknown API endpoint (404)';
module.exports['411'] = 'Unknown API endpoint (411)'; // isn't 404, but it is...
module.exports.Unauthorized = 'Unauthorized: please ensure you are ' +
  'logged using `snyk auth`';
module.exports.MISSING_DOTFILE = 'Cannot find .snyk in this ' +
  'project, make to create one with `snyk protect --interactive`';

module.exports['401'] = module.exports.Unauthorized;