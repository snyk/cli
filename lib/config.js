var config = require('snyk-config')(__dirname + '/..');

var DEFAULT_TIMEOUT = 5 * 60; // in seconds

// allow user config override of the api end point
var endpoint = require('./user-config').get('endpoint');
if (endpoint) {
  config.API = endpoint;
}

var org = require('./user-config').get('org');
if (!config.org && org) {
  config.org = org;
}

// client request timeout
// to change, set this config key to the desired value in seconds
// invalid (non-numeric) value will fallback to the default
var timeout = require('./user-config').get('timeout');
if (!config.timeout) {
  config.timeout = +timeout ? +timeout : DEFAULT_TIMEOUT;
}

// this is a bit of an assumption that our web site origin is the same
// as our API origin, but for now it's okay - RS 2015-10-16
if (!config.ROOT) {
  var url = require('url');
  var apiUrl = url.parse(config.API);
  config.ROOT = apiUrl.protocol + '//' + apiUrl.host;
}

module.exports = config;
