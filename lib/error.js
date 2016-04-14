var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('../lib/config');
var chalk = require('chalk');

var errors = {
  connect: 'Check your network connection, failed to connect to Snyk API',
  endpoint: 'The Snyk API is not available on ' + config.API,
  auth: 'Unauthorized: please ensure you are logged using `snyk auth`',
  dotfile: 'Try running `snyk wizard` to define a Snyk protect policy',
  authfail: 'Authentication failed. Please check the API token on ' +
    config.ROOT,
  oldsnyk: 'You have an alpha format Snyk policy file in this directory. ' +
    'Please remove it, and re-create using `snyk wizard`',
  notfound: 'The package could not be found or does not exist',
  patchfail: 'The patch against %s failed.\nEmail support@snyk.io if this ' +
    'problem persists.',
  updatefail: 'Encountered errors while running `npm update`.\nRun ' +
    '`npm update` when the wizard completes to ensure updates have been ' +
    'applied.',
  updatepackage: 'Upgrade this package to "%s", then run the wizard again.',
  nodeModules: 'This directory looks like a node project, but is missing the ' +
    'contents of the node_modules directory.\nPlease run `npm install` and ' +
    're-run your snyk command.',
  tryDevDeps: 'Snyk only tests production dependencies by default (which ' +
    'this project had none). Try re-running with the `--dev` flag.',
  noAuthInCI: 'Github auth cannot be used whilst inside CI. You must include ' +
    'your API token as an environment value: `API=12345678`',
  noApiToken: '%s requires an authenticated account. Please run `snyk auth` ' +
    'and try again.',
};

// a key/value pair of error.code (or error.message) as the key, and our nice
// strings as the value.
var codes = {
  ECONNREFUSED: errors.connect,
  ENOTFOUND: errors.connect,
  NOT_FOUND: errors.notfound,
  404: errors.notfound,
  411: errors.endpoint, // try to post to a weird endpoint
  403: errors.endpoint,
  401: errors.auth,
  Unauthorized: errors.auth,
  MISSING_DOTFILE: errors.dotfile,
  MISSING_NODE_MODULES: errors.nodeModules,
  OLD_DOTFILE_FORMAT: errors.oldsnyk,
  FAIL_PATCH: errors.patchfail,
  FAIL_UPDATE: errors.updatefail,
  NOT_FOUND_HAS_DEV_DEPS: errors.tryDevDeps,
  NO_API_TOKEN: errors.noApiToken,
};

module.exports = function error(command) {
  var e = new Error('Unknown command "' + command + '"');
  e.code = 'UNKNOWN_COMMAND';
  return Promise.reject(e);
};

module.exports.message = function (error) {
  var message = error; // defaults to a string (which is super unlikely)
  if (error instanceof Error) {
    // try to lookup the error string based either on the error code OR
    // the actual error.message (which can be "Unauthorized" for instance),
    // otherwise send the error message back
    message = codes[error.code || error.message] ||
              errors[error.code || error.message];
    if (message) {
      message = message.replace(/(%s)/g, error.message).trim();
      message = chalk.bold.red(message);
    } else {
      message = error.message;
    }
  }

  return message;
};
