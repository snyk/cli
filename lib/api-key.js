module.exports = api;
module.exports.required = required;

var config = require('./config');
var userConfig = require('./user-config');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var error = new Error('NO_API_KEY');
error.code = 'NO_API_KEY';

function api() {
  // note: config.TOKEN will potentially come via the environment
  return config.api || config.TOKEN || userConfig.get('api');
}

function required(label) {
  error.message = label || error.code;
  return api() ? Promise.resolve() : Promise.reject(error);
}
