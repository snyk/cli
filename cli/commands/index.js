var abbrev = require('abbrev');

// this will speed up the module load time, only loading the CLI commands
// as needed by the user, and totally avoiding if the module is being required
// into a user project
function hotload(name) {
  var module = null;
  return function () {
    if (module === null) {
      module = require(name);
    }

    return module.apply(null, arguments);
  };
}

var commands = {
  help: hotload('./help'),
  auth: hotload('./auth'),
  version: hotload('./version'),
  error: hotload('./error'),
  config: hotload('./config'),
  monitor: hotload('./monitor'),
  test: hotload('./test'),
  protect: hotload('./protect'),
  support: hotload('./support'),
  // watch: hotload('./watch'),
  // modules: hotload('./modules'),
};
commands.aliases = abbrev(Object.keys(commands));

module.exports = commands;