var abbrev = require('abbrev');

var commands = {
  help: require('./help'),
  auth: require('./auth'),
  version: require('./version'),
  error: require('./error'),
  config: require('./config'),
  snapshot: require('./snapshot'),
  test: require('./test'),
  protect: require('./protect'),
  // watch: require('./watch'),
  // modules: require('./modules'),
};
commands.aliases = abbrev(Object.keys(commands));

module.exports = commands;