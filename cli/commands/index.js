var abbrev = require('abbrev');

var commands = {
  help: require('./help'),
  auth: require('./auth'),
  version: require('./version'),
  error: require('./error'),
  config: require('./config'),
  monitor: require('./monitor'),
  test: require('./test'),
  protect: require('./protect'),
  support: require('./support'),
  // watch: require('./watch'),
  // modules: require('./modules'),
};
commands.aliases = abbrev(Object.keys(commands));

module.exports = commands;