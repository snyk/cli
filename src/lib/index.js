const snykConfig = require('./config');

// This module is kind of "world object" that is used to indirectly import modules.
// This also introduces some circular imports.

// TODO(kyegupov): untangle this, resolve circular imports, convert to Typescript

const snyk = {};
module.exports = snyk;

snyk.id = snykConfig.id;

const apiToken = require('./api-token');

// make snyk.api *always* get the latest api token from the config store
Object.defineProperty(snyk, 'api', {
  enumerable: true,
  configurable: true,
  get: function() {
    return apiToken.api();
  },
  set: function(value) {
    snykConfig.api = value;
  },
});

snyk.modules = require('./modules');
snyk.test = require('./snyk-test');
snyk.bus = require('./bus');
snyk.policy = require('snyk-policy');
snyk.isRequired = true; // changed to false when loaded via cli
snyk.isolate = {
  okay: function() {
    return true;
  },
};

// this is the user config, and not the internal config
snyk.config = require('./user-config').config;
