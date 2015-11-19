var abbrev = require('abbrev');
var snyk = require('../../lib');

snyk.isRequired = false;

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
  config: hotload('./config'),
  monitor: hotload('./monitor'),
  test: hotload('./test'),
  protect: hotload('./protect'),
  support: hotload('./support'),
  wizard: hotload('./protect/wizard'),
  // modules: hotload('./modules'),
};
commands.aliases = abbrev(Object.keys(commands));
module.exports = commands;
