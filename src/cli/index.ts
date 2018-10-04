#!/usr/bin/env node
import 'source-map-support/register';

// assert supported node runtime version
import * as runtime from './runtime';
// require analytics as soon as possible to start measuring execution time
import * as analytics from '../lib/analytics';
import * as alerts from '../lib/alerts';
import * as sln from '../lib/sln';
import argsLib from './args';
import copy from './copy';
import spinner = require('../lib/spinner');
import errors = require('../lib/error');
import ansiEscapes = require('ansi-escapes');

async function runCommand(args) {
  const result = await args.method(...args.options._);

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
}

async function handleError(args, error) {
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
        if (`${error.code}`.indexOf('AUTH_') === 0) {
          // remove the last few lines
          const erase = ansiEscapes.eraseLines(4);
          process.stdout.write(erase);
        }
        console.log(result);
      }
    }
  }

  return res;
}

function checkRuntime() {
  if (!runtime.isSupported(process.versions.node)) {
    console.error(`${process.versions.node} is an unsupported nodejs ` +
      `runtime! Supported runtime range is '${runtime.supportedRange}'`);
    console.error('Please upgrade your nodejs runtime version and try again.');
    process.exit(1);
  }
}

async function main() {
  checkRuntime();

  const args = argsLib(process.argv);

  if (args.options.file && args.options.file.match(/\.sln$/)) {
    sln.updateArgs(args);
  }

  let res = null;
  let failed = false;

  try {
    res = await runCommand(args);
  } catch (error) {
    failed = true;
    res = await handleError(args, error);
  }

  if (!args.options.json) {
    console.log(alerts.displayAlerts());
  }

  if (!process.env.TAP && failed) {
    process.exit(1);
  }

  return res;
}

const cli = main().catch((e) => {
  console.log('super fail', e.stack);
  process.exit(1);
});

if (module.parent) {
  module.exports = cli;
}
