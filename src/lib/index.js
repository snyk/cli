module.exports = snyk;

var cluster = require('cluster');
var snykConfig = require('./config');

// This module exports a function with properties attached.
// The properties represent other modules - so, it's some kind of "world object"
// that is used to indirectly import modules.
// The function modifies the object and returns it.
// This also introduces some circular imports.

// TODO(kyegupov): untangle this, resolve circular imports, convert to Typescript

function snyk(options) {
  if (!options) {
    options = {};
  }

  if (options.api) {
    snykConfig.api = options.api;
  }

  if (options.id) {
    snyk.id = options.id;
  }

  // FIXME add in pid + whether master + hostname + all these fields

  snyk.config.isMaster = cluster.isMaster;

  if (options.monitor && snyk.config.isMaster) {
    if (!snyk.api) {
      throw new Error('Snyk monitors require an authenticated account ' +
        'and API token');
    }
    // hook();
    require('./capture')();
  }

  return snyk;
}

snyk.id = snykConfig.id;

var apiToken = require('./api-token');

// make snyk.api *always* get the latest api token from the config store
Object.defineProperty(snyk, 'api', {
  enumerable: true,
  configurable: true,
  get: function () {
    return apiToken();
  },
  set: function (value) {
    snykConfig.api = value;
  },
});

snyk.modules = require('./modules');
snyk.test = require('./snyk-test');
snyk.bus = require('./bus');
snyk.policy = require('snyk-policy');
snyk.isRequired = true; // changed to false when loaded via cli
snyk.isolate = {
  okay: function () {
    return true;
  },
};

// this is the user config, and not the internal config
snyk.config = require('./user-config');
