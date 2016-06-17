var config = require('snyk-config')(__dirname + '/..');

// allow user config override of the api end point
var endpoint = require('./user-config').get('endpoint');
if (endpoint) {
  config.API = endpoint;
}

var org = require('./user-config').get('org');
if (!config.org && org) {
  config.org = org;
}

// this is a bit of an assumption that our web site origin is the same
// as our API origin, but for now it's okay - RS 2015-10-16
if (!config.ROOT) {
  var url = require('url');
  var apiUrl = url.parse(config.API);
  config.ROOT = apiUrl.protocol + '//' + apiUrl.host;
}

module.exports = config;
