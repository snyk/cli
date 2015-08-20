module.exports = snyk;

var cluster = require('cluster');
var hook = require('./hook');

function snyk(options) {
  if (!options) {
    options = {};
  }

  if (options.api) {
    snyk.api = options.api;
  } else {
    snyk.api = snyk.config.get('api') || null;
  }

  snyk.id = options.id || snyk.config.get('id');

  // FIXME add in pid + whether master + hostname + all these fields

  snyk.config.isMaster = cluster.isMaster;

  if (options.snapshot && snyk.config.isMaster) {
    if (!snyk.api) {
      throw new Error('Snyk snapshots require an authenticated account ' +
        'and API key');
    }
    snyk.snapshot.capture();
    hook();
  }

  return snyk;
}

snyk.api = null;
snyk.modules = require('./modules');
snyk.watch = require('./watch');
snyk.test = require('./test');
snyk.snapshot = require('./snapshot');
snyk.bus = require('./bus');
snyk.isolate = {
  okay: function () {
    return true;
  },
};

// this is the user config, and not the internal config
snyk.config = require('./user-config');