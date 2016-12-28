module.exports = args;

var abbrev = require('abbrev');
var alias = abbrev('copy', 'version', 'debug', 'help', 'quiet', 'interactive',
  'dev');
alias.d = 'debug'; // always make `-d` debug
alias.t = 'test';

function args(processargv) {
  // allows us to support flags with true or false only
  var argv = processargv.slice(2).reduce(function reduce(acc, arg) {
    if (arg.indexOf('-') === 0) {
      arg = arg.slice(1);

      if (alias[arg] !== undefined) {
        acc[alias[arg]] = true;
      } else if (arg.indexOf('-') === 0) {
        arg = arg.slice(1);
        if (arg.indexOf('=') === -1) {
          acc[arg] = true;
        } else {
          var parts = arg.split('=');
          acc[parts.shift()] = parts.join('=');
        }
      } else {
        acc[arg] = true;
      }
    } else {
      acc._.push(arg);
    }

    return acc;
  }, { _: [] });

  // by passing `-d` to the cli, we enable the debugging output, but this must
  // be as early as possible in the cli logic to capture all the output
  if (argv.debug) {
    var enable = 'snyk';
    if (process.env.DEBUG) {
      enable += ',' + process.env.DEBUG;
    }
    require('debug').enable(enable);
  }

  var debug = require('debug')('snyk');

  // this is done after the debug activation line above because we want to see
  // the debug messaging when we use the `-d` flag
  var cli = require('./commands');

  // the first argument is the command we'll execute, everything else will be
  // an argument to our command, like `snyk help protect`
  var command = argv._.shift();

  // alias switcheroo - allows us to have
  if (cli.aliases[command]) {
    command = cli.aliases[command];
  }

  // alias `-v` to `snyk version`
  if (argv.version) {
    command = 'version';
  }

  if (!command || argv.help || command === 'help') {
    // bit of a song and dance to support `snyk -h` and `snyk help`
    if (argv.help === true || command === 'help') {
      argv.help = 'help';
    }
    command = 'help';

    if (!argv._.length) {
      argv._.unshift(argv.help || 'usage');
    }
  }

  if (command && command.indexOf('config:') === 0) {
    // config looks like `config:set x=y` or `config:get x`
    // so we need to mangle the commands into this format:
    // snyk.config('set', 'api=x')
    // snyk.config('get', 'api') // etc
    var tmp = command.split(':');
    command = tmp.shift();
    argv._.unshift(tmp.shift());
  }

  var method = cli[command];

  if (!method) {
    // if we failed to find a command, then default to an error
    if (!method) {
      method = require('../lib/error');
      argv._.push(command);
    }
  }

  // TODO decide why we can't do this cart blanche...
  if (command === 'protect' ||
      command === 'test' ||
      command === 'modules' ||
      command === 'scenario' ||
      command === 'monitor' ||
      command === 'wizard') {
    // copy all the options across to argv._ as an object
    argv._.push(argv);
  }

  debug(command, argv);

  return {
    method: method,
    command: command,
    options: argv,
  };
}
