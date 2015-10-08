#!/usr/bin/env node

var abbrev = require('abbrev');
var alias = abbrev('version', 'debug', 'help', 'quiet', 'interactive');

// allows us to support flags with true or false only
var argv = process.argv.slice(2).reduce(function reduce(acc, arg) {
  if (arg.indexOf('-') === 0) {
    arg = arg.slice(1);

    if (alias[arg] !== undefined) {
      acc[alias[arg]] = true;
    } else if (arg.indexOf('-') === 0) {
      acc[arg.slice(1)] = true;
    } else {
      acc[arg] = true;
    }
  } else {
    acc._.push(arg);
  }

  return acc;
}, { _: [] });

if (argv.debug) {
  require('debug').enable('snyk');
}

if (argv.version) {
  argv._ = ['version'];
}

var debug = require('debug')('snyk');

// this is done after the debug activation line above
// because we want to see the debug messaging when we
// use the `-d` flag
var cli = require('./commands');

var command = argv._.shift();


// alias switcheroo
if (cli.aliases[command]) {
  command = cli.aliases[command];
}

if (argv.version) {
  command = 'version';
}

if (!command || argv.help || command === 'help') {
  // bit of a song and dance to support `snyk -h` and `snyk help`
  if (argv.help === true || command === 'help') {
    argv.help = 'help';
  }
  command = 'help';

  argv._.unshift(argv.help || 'usage');
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
    method = cli.error;
    argv._.push(command);
  }
}

if (command === 'protect' ||
    command === 'test') {
  // copy all the options across to argv._ as an object
  argv._.push(argv);
}

debug(command, argv);

method.apply(null, argv._).then(function (result) {
  if (result && !argv.quiet) {
    console.log(result);
  }
}).catch(function (error) {
  if (argv.debug) {
    console.log(error.stack);
  } else {
    if (!argv.quiet) {
      if (cli.errorMessage[error.code || error.message]) {
        console.log(cli.errorMessage[error.code || error.message]);
      } else {
        console.log(error.message);
      }
    }
  }
  process.exit(1);
});

debug('checking for cli updates');
// finally, check for available update and returns an instance
var defaults = require('lodash').defaults;
var pkg = require('../package.json');

require('update-notifier')({
  pkg: defaults(pkg, { version: '0.0.0' }),
}).notify();
