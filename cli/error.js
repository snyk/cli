var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('../lib/config');

var errors = {
  connect: 'Check your network connection, failed to connect to Snyk API',
  endpoint: 'The Snyk API is not available on ' + config.API,
  auth: 'Unauthorized: please ensure you are logged using `snyk auth`',
  dotfile: 'Try running `snyk protect -i` to define a Snyk protect policy',
  authfail: 'Authentication failed. Please check the API key on ' + config.ROOT,
  oldsnyk: 'You have an alpha format .snyk file in this directory. Please ' +
    'remove it, and re-create using `snyk protect -i`',
  notfound: 'The package could not be found or does not exist',
};

// a key/value pair of error.code (or error.message) as the key, and our nice
// strings as the value.
var codes = {
  ECONNREFUSED: errors.connect,
  404: errors.notfound,
  411: errors.endpoint, // try to post to a weird endpoint
  403: errors.endpoint,
  401: errors.auth,
  Unauthorized: errors.auth,
  MISSING_DOTFILE: errors.dotfile,
  OLD_DOTFILE_FORMAT: errors.oldsnyk,
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