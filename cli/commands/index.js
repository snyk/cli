var abbrev = require('abbrev');
var hotload = require('../../lib/hotload')(__dirname);
require('../../lib/spinner').isRequired = false;

// the aim of this module is to load as little as possible to keep cli boot
// time as low as possible

var commands = {
  help: hotload('./help'),
  auth: hotload('./auth'),
  version: hotload('./version'),
  config: hotload('./config'),
  monitor: hotload('./monitor'),
  test: hotload('./test'),
  policy: hotload('./policy'),
  protect: hotload('./protect'),
  support: hotload('./support'),
  wizard: hotload('./protect/wizard'),
  modules: hotload('./modules'),
  scenario: hotload('./scenario'),
};
commands.aliases = abbrev(Object.keys(commands));
module.exports = commands;
