'use strict';
module.exports = args;

const debug = require('debug')('clite');
const abbrev = require('abbrev');
const getSettings = require('./settings');
const yargslib = require('yargs');
const defaultsDeep = require('lodash.defaultsdeep');

function args(argv, config) {
  let settings = getSettings(config);
  if (!Array.isArray(argv)) {
    throw new Error('process.argv type expected');
  }

  let aliases = Object.keys(settings.alias);
  let all = settings.options
    .concat(settings.booleans)
    .concat(Object.keys(settings.commands))
    .concat(aliases);

  let aliasShortcuts = abbrev(aliases);

  // fixes up any issues
  settings.options.forEach(t => delete settings.alias[t]);
  debug('config', config);

  if (!settings.yargs) {
    settings.yargs = {};
    settings.options.forEach(cmd => {
      settings.yargs[cmd] = {
        describe: cmd,
      };
    });

    settings.booleans.forEach(cmd => {
      settings.yargs[cmd] = {
        type: 'boolean',
        describe: cmd,
      };
    });
  }

  defaultsDeep(settings.alias, abbrev(all));

  // set abbreviated aliases to have the value of the alias
  Object.keys(aliasShortcuts).forEach(a => {
    settings.alias[a] = settings.alias[aliasShortcuts[a]];
  });

  // total hack to capture the yargs help output
  let res = yargslib.reset().options(settings.yargs);
  var help = '';
  var old = console.log;
  console.log = function (s) {
    help = s;
  };
  res.showHelp('log');
  console.log = old;

  let yargs = yargslib.reset().options(settings.yargs).alias(settings.alias);
  let args = yargs.parse(argv);

  args.argv = args._.slice(0);
  args._.splice(0, 2); // now remove the `node` + script name

  debug('args', args);

  let override = false;

  if (args.help) {
    override = 'help';
    if (args._.length) {
      args.help = args._.pop();
    }
  }

  if (args.version) {
    override = 'version';
  }

  args.$_ = settings.commands[override || args._[0]] || // override or real
            settings.commands[settings.alias[args._[0]]] || // alias
            settings.commands._; // default

  // if there's no command config, then try to let the command match the
  // file system
  let userCommands = Object.keys((config || {}).commands || []).length;
  if (!args.$_ && args._.length && userCommands === 0) {
    args.$_ = args._.shift();
  }

  // if our command was used off the CLI arg, then let's remove it from the
  // command args
  if (args.$_ === settings.commands[args._[0]]) {
    args._.shift();
  }

  return {
    help,
    args,
  };
}