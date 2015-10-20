var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('../lib/config');

var errors = {
  connect: 'Check your network connection, failed to connect to Snyk API',
  endpoint: 'The Snyk API is not available on ' + config.API,
  auth: 'Unauthorized: please ensure you are logged using `snyk auth`',
  dotfile: 'Try running `snyk protect -i` to define a Snyk protect policy',
};

// a key/value pair of error.code (or error.message) as the key, and our nice
// strings as the value.
var codes = {
  ECONNREFUSED: errors.connect,
  404: errors.endpoint,
  411: errors.endpoint,
  403: errors.endpoint,
  401: errors.auth,
  Unauthorized: errors.auth,
  MISSING_DOTFILE: errors.dotfile,
};

module.exports = function error(command) {
  return Promise.reject(new Error('Unknown command "' + command + '"'));
};

module.exports.message = function (error) {
  if (error instanceof Error) {
    // try to lookup the error string based either on the error code OR
    // the actual error.message (which can be "Unauthorized" for instance),
    // otherwise send the error message back
    return codes[error.code || error.message] || error.message;
  } else {
    return error; // string
  }
};