module.exports = api;
module.exports.exists = exists;

var config = require('./config');
var userConfig = require('./user-config');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var error = new Error('NO_API_TOKEN');
error.code = 'NO_API_TOKEN';

function api() {
  // note: config.TOKEN will potentially come via the environment
  return config.api || config.TOKEN || userConfig.get('api');
}

function exists(label) {
  error.message = label || error.code;
  return api() ? Promise.resolve() : Promise.reject(error);
}
