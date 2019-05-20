var abbrev = require('abbrev');
var hotload = require('../../lib/hotload')(__dirname);
require('../../lib/spinner').isRequired = false;

// the aim of this module is to load as little as possible to keep cli boot
// time as low as possible

var commands = {
  auth: hotload('./auth'),
  config: hotload('./config'),
  help: hotload('./help'),
  ignore: hotload('./ignore'),
  modules: hotload('./modules'),
  monitor: hotload('./monitor'),
  policy: hotload('./policy'),
  protect: hotload('./protect'),
  scenario: hotload('./scenario'),
  test: hotload('./test'),
  'test-unpublished': hotload('./unpublished'),
  version: hotload('./version'),
  wizard: hotload('./protect/wizard'),
};
commands.aliases = abbrev(Object.keys(commands));
commands.aliases.t = 'test';
module.exports = commands;
