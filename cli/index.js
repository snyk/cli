#!/usr/bin/env node

// require analytics as soon as possible to start measuring execution time
var analytics = require('../lib/analytics');
var args = require('./args')(process.argv);
var debug = require('debug')('snyk');
var copy = require('./copy');
var alerts = require('../lib/alerts');
var sln = require('../lib/sln');
var exitcode = 0;

if (args.options.file && args.options.file.match(/\.sln$/)) {
  sln.updateArgs(args);
}

var cli = args.method.apply(null, args.options._).then(function (result) {
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
  var command = 'bad-command';

  if (error.code === 'VULNS') {
    // this isn't a bad command, so we won't record it as such
    command = args.command;
  } else if (!error.stack) { // log errors that are not error objects
    analytics.add('error', JSON.stringify(error));
    analytics.add('command', args.command);
  } else {
    // remove vulnerabilities from the errors
    // to keep the logs small
    if (error.stack && error.stack.vulnerabilities) {
      delete error.vulnerabilities;
    }
    if (error.message && error.message.vulnerabilities) {
      delete error.message.vulnerabilities;
    }
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
  if (!args.options.json) {
    console.log(alerts.displayAlerts());
  }
  if (!process.env.TAP && exitcode) {
    return process.exit(1);
  }
  return res;
});

if (module.parent) {
  module.exports = cli;
}
