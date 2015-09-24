var config = require('@snyk/config')(__dirname + '/..');

// allow user config override of the api end point
var endpoint = require('./user-config').get('endpoint');
if (endpoint) {
  config.API = endpoint;
}

module.exports = config;