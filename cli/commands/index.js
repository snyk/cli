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
  wizard: hotload('./protect/wizard'),
  modules: hotload('./modules'),
  scenario: hotload('./scenario'),
  'test-unpublished': hotload('./unpublished'),
};
commands.aliases = abbrev(Object.keys(commands));
commands.aliases.t = 'test';
module.exports = commands;
