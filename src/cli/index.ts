#!/usr/bin/env node
import 'source-map-support/register';

// assert supported node runtime version
import * as runtime from './runtime';
// require analytics as soon as possible to start measuring execution time
import * as analytics from '../lib/analytics';
import * as alerts from '../lib/alerts';
import * as sln from '../lib/sln';
import argsLib = require('./args');
import copy = require('./copy');
import spinner = require('../lib/spinner');
import errors = require('../lib/error');
import ansiEscapes = require('ansi-escapes');

const args = argsLib(process.argv);

if (!runtime.isSupported(process.versions.node)) {
  console.error(process.versions.node +
    ' is an unsupported nodejs runtime! Supported runtime range is \'' +
    runtime.supportedRange + '\'');
  console.error('Please upgrade your nodejs runtime version ' +
    'and try again.');
  process.exit(1);
}
let exitcode = 0;

if (args.options.file && args.options.file.match(/\.sln$/)) {
  sln.updateArgs(args);
}

const cli = args.method.apply(null, args.options._).then((result) => {
  const res = analytics({
    args: args.options._,
    command: args.command,
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
}).catch((error) => {
  spinner.clearAll();
  let command = 'bad-command';

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

  const res = analytics({
    args: args.options._,
    command,
  });

  if (args.options.debug) {
    console.log(error.stack);
  } else {
    if (!args.options.quiet) {

      const result = errors.message(error);
      if (args.options.copy) {
        copy(result);
        console.log('Result copied to clipboard');
      } else {
        if ((error.code + '').indexOf('AUTH_') === 0) {
          // remove the last few lines
          const erase = ansiEscapes.eraseLines(4);
          process.stdout.write(erase);
        }
        console.log(result);
      }
    }
  }

  exitcode = 1;
  return res;
}).catch((e) => {
  console.log('super fail', e.stack);
}).then((res) => {
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
