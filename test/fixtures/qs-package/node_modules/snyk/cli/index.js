#!/usr/bin/env node

var args = require('./args')(process.argv);
var debug = require('debug')('snyk');
var copy = require('./copy');

var exitcode = 0;

var cli = args.method.apply(null, args.options._).then(function (result) {
  var analytics = require('../lib/analytics');
  var res = analytics({
    command: args.command,
    args: args.options._,
  });
  if (result && !args.options.quiet) {
    if (args.options.copy) {
      copy(result);
      console.log('Result copied to clipboard');
    } else {
      console.log(result);
    }
  }
  return res;
}).catch(function (error) {
  var spinner = require('../lib/spinner');
  spinner.clearAll();
  var analytics = require('../lib/analytics');
  var command = 'bad-command';

  if (error.code === 'VULNS') {
    // this isn't a bad command, so we won't record it as such
    command = args.command;
  } else {
    analytics.add('error-message', error.message);
    analytics.add('error', error.stack);
    analytics.add('error-code', error.code);
    analytics.add('command', args.command);
  }

  var res = analytics({
    command: command,
    args: args.options._,
  });

  if (args.options.debug) {
    console.log(error.stack);
  } else {
    var errors = require('../lib/error');
    if (!args.options.quiet) {

      var result = errors.message(error);
      if (args.options.copy) {
        copy(result);
        console.log('Result copied to clipboard');
      } else {
        if ((error.code + '').indexOf('AUTH_') === 0) {
          var ansiEscapes = require('ansi-escapes');
          // remove the last few lines
          var erase = ansiEscapes.eraseLines(4);
          process.stdout.write(erase);
        }
        console.log(result);
      }
    }
  }

  exitcode = 1;
  return res;
}).catch(function (e) {
  console.log('super fail', e.stack);
}).then(function (res) {
  if (!process.env.TAP && exitcode) {
    return process.exit(1);
  }
  return res;
});

if (module.parent) {
  module.exports = cli;
} else {
  debug('checking for cli updates');
  // finally, check for available update and returns an instance
  var defaults = require('lodash').defaults;
  var pkg = require('../package.json');

  // only run if we're not inside an npm.script
  if (!process.env['npm_config_node_version']) { // jshint ignore:line
    require('update-notifier')({
      pkg: defaults(pkg, { version: '0.0.0' }),
    }).notify();
  }
}
