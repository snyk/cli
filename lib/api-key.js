module.exports = api;

var config = require('./config');
var userConfig = require('./user-config');

function api() {
  return config.api || userConfig.get('api');
}