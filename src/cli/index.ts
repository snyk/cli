#!/usr/bin/env node
import 'source-map-support/register';
import * as Debug from 'debug';

// assert supported node runtime version
import * as runtime from './runtime';
// require analytics as soon as possible to start measuring execution time
import * as analytics from '../lib/analytics';
import * as alerts from '../lib/alerts';
import * as sln from '../lib/sln';
import { args as argsLib, Args } from './args';
import { copy } from './copy';
import spinner = require('../lib/spinner');
import errors = require('../lib/errors/legacy-errors');
import ansiEscapes = require('ansi-escapes');
import { isPathToPackageFile } from '../lib/detect';
import { updateCheck } from '../lib/updater';
import { MissingTargetFileError, FileFlagBadInputError } from '../lib/errors';
import { UnsupportedOptionCombinationError } from '../lib/errors/unsupported-option-combination-error';
import stripAnsi from 'strip-ansi';

const debug = Debug('snyk');
const EXIT_CODES = {
  VULNS_FOUND: 1,
  ERROR: 2,
};

async function runCommand(args: Args) {
  const result = await args.method(...args.options._);
  const res = analytics({
    args: args.options._,
    command: args.command,
    org: args.options.org,
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
  let exitCode = EXIT_CODES.ERROR;

  const vulnsFound = error.code === 'VULNS';
  if (vulnsFound) {
    // this isn't a bad command, so we won't record it as such
    command = args.command;
    exitCode = EXIT_CODES.VULNS_FOUND;
  }

  if (args.options.debug && !args.options.json) {
    const output = vulnsFound ? error.message : error.stack;
    console.log(output);
  } else if (args.options.json) {
    console.log(stripAnsi(error.json || error.stack));
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

  const analyticsError = vulnsFound
    ? {
        stack: error.jsonNoVulns,
        code: error.code,
        message: 'Vulnerabilities found',
      }
    : {
        stack: error.stack,
        code: error.code,
        message: error.message,
      };

  if (!vulnsFound && !error.stack) {
    // log errors that are not error objects
    analytics.add('error', JSON.stringify(analyticsError));
    analytics.add('command', args.command);
  } else {
    analytics.add('error-message', analyticsError.message);
    // Note that error.stack would also contain the error message
    // (see https://nodejs.org/api/errors.html#errors_error_stack)
    analytics.add('error', analyticsError.stack);
    analytics.add('error-code', error.code);
    analytics.add('command', args.command);
  }

  const res = analytics({
    args: args.options._,
    command,
    org: args.options.org,
  });

  return { res, exitCode };
}

function checkRuntime() {
  if (!runtime.isSupported(process.versions.node)) {
    console.error(
      `${process.versions.node} is an unsupported nodejs ` +
        `runtime! Supported runtime range is '${runtime.supportedRange}'`,
    );
    console.error('Please upgrade your nodejs runtime version and try again.');
    process.exit(EXIT_CODES.ERROR);
  }
}

// Throw error if user specifies package file name as part of path,
// and if user specifies multiple paths and used project-name option.
function checkPaths(args) {
  let count = 0;
  for (const path of args.options._) {
    if (typeof path === 'string' && isPathToPackageFile(path)) {
      throw MissingTargetFileError(path);
    } else if (typeof path === 'string') {
      if (++count > 1 && args.options['project-name']) {
        throw new UnsupportedOptionCombinationError([
          'multiple paths',
          'project-name',
        ]);
      }
    }
  }
}

async function main() {
  updateCheck();
  checkRuntime();

  const args = argsLib(process.argv);
  let res;
  let failed = false;
  let exitCode = EXIT_CODES.ERROR;
  try {
    if (args.options.scanAllUnmanaged && args.options.file) {
      throw new UnsupportedOptionCombinationError([
        'file',
        'scan-all-unmanaged',
      ]);
    }
    if (
      args.options.file &&
      typeof args.options.file === 'string' &&
      (args.options.file as string).match(/\.sln$/)
    ) {
      if (args.options['project-name']) {
        throw new UnsupportedOptionCombinationError([
          'file=*.sln',
          'project-name',
        ]);
      }
      sln.updateArgs(args);
    } else if (typeof args.options.file === 'boolean') {
      throw new FileFlagBadInputError();
    }

    checkPaths(args);

    res = await runCommand(args);
  } catch (error) {
    failed = true;

    const response = await handleError(args, error);
    res = response.res;
    exitCode = response.exitCode;
  }

  if (runtime.isUsingNode6(process.versions.node)) {
    alerts.registerAlerts([
      {
        msg:
          'Node.js v6 has past End-of-Life; please upgrade your current Node.js version ' +
          'to continue scanning and protecting your projects from security vulnerabilities.',
        name: 'Node6EOLWarning',
        type: 'info',
      },
    ]);
  }

  if (!args.options.json) {
    console.log(alerts.displayAlerts());
  }

  if (!process.env.TAP && failed) {
    debug('Exit code: ' + exitCode);
    process.exitCode = exitCode;
  }

  return res;
}

const cli = main().catch((e) => {
  console.error('Something unexpected went wrong: ', e.stack);
  console.error('Exit code: ' + EXIT_CODES.ERROR);
  process.exit(EXIT_CODES.ERROR);
});

if (module.parent) {
  // eslint-disable-next-line id-blacklist
  module.exports = cli;
}
