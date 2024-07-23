import * as Debug from 'debug';
import * as pathLib from 'path';
import { JsonStreamStringify } from 'json-stream-stringify';

// import args as a first internal module
import { args as argsLib, Args, ArgsOptions } from './args';
// parse args as a first thing; argsLib modifies global namespace
// therefore it is better to do it as a first thing to prevent bugs
// when modules use this global setting during their require phase
// TODO(code): remove once https://app.stepsize.com/issue/c2f6253e-7240-436f-943c-23a897558156/2-http-libraries-in-cli is solved
const globalArgs = argsLib(process.argv);
// assert supported node runtime version
import * as runtime from './runtime';
// require analytics as soon as possible to start measuring execution time
import * as analytics from '../lib/analytics';
import * as alerts from '../lib/alerts';
import * as sln from '../lib/sln';
import { TestCommandResult } from './commands/types';
import { copy } from './copy';
import { spinner } from '../lib/spinner';
import * as errors from '../lib/errors/legacy-errors';
import * as ansiEscapes from 'ansi-escapes';

import {
  FileFlagBadInputError,
  MissingOptionError,
  UnsupportedOptionCombinationError,
  ExcludeFlagBadInputError,
  CustomError,
  NoSupportedSastFiles,
} from '../lib/errors';
import { IaCErrorCodes } from './commands/test/iac/local-execution/types';
import stripAnsi = require('strip-ansi');
import { ExcludeFlagInvalidInputError } from '../lib/errors/exclude-flag-invalid-input';
import { modeValidation } from './modes';
import { JsonFileOutputBadInputError } from '../lib/errors/json-file-output-bad-input-error';
import {
  saveObjectToFile,
  saveJsonToFileCreatingDirectoryIfRequired,
} from '../lib/json-file-output';
import {
  Options,
  TestOptions,
  MonitorOptions,
  SupportedUserReachableFacingCliArgs,
} from '../lib/types';
import { SarifFileOutputEmptyError } from '../lib/errors/empty-sarif-output-error';
import { InvalidDetectionDepthValue } from '../lib/errors/invalid-detection-depth-value';
import { obfuscateArgs } from '../lib/utils';
import { EXIT_CODES } from './exit-codes';
const isEmpty = require('lodash/isEmpty');

const debug = Debug('snyk');

async function runCommand(args: Args) {
  const commandResult = await args.method(...args.options._);

  const res = analytics.addDataAndSend({
    args: obfuscateArgs(args.options._),
    command: args.command,
    org: args.options.org,
  });

  if (!commandResult) {
    return;
  }

  const result = commandResult.toString();

  if (result && !args.options.quiet) {
    if (args.options.copy) {
      copy(result);
      console.log('Result copied to clipboard');
    } else {
      console.log(result);
    }
  }

  // also save the json (in error.json) to file if option is set
  if (args.command === 'test') {
    const jsonResults = (commandResult as TestCommandResult).getJsonResult();
    const jsonPayload = (commandResult as TestCommandResult).getJsonData();
    await saveResultsToFile(args.options, 'json', jsonResults, jsonPayload);
    const sarifResults = (commandResult as TestCommandResult).getSarifResult();
    await saveResultsToFile(args.options, 'sarif', sarifResults);
  }

  return res;
}

async function handleError(args, error) {
  spinner.clearAll();

  if (typeof error === 'object') {
    error.stack = error.nestedStack || error.stack;
    error.userMessage = error.nestedUserMessage || error.userMessage;
    error.code = error.nestedCode || error.code;
    error.strCode = error.nestedStrCode || error.strCode;
    error.userMessage = error.nestedUserMessage || error.userMessage;
  }

  let command = 'bad-command';
  let exitCode = EXIT_CODES.ERROR;

  // If Snyk CLI is running in CI mode (SNYK_CI=1), differentiate authorization
  if (process.env.SNYK_CI === '1') {
    if (error.code === 401 || error.code === 403) {
      exitCode = EXIT_CODES.EX_NOPERM;
    } else if (error.code >= 400 && error.code < 500) {
      exitCode = EXIT_CODES.EX_UNAVAILABLE;
    }
  }

  const vulnsFound = error.code === 'VULNS';

  if (args.command === 'test' && args.options?.unmanaged) {
    exitCode = vulnsFound ? EXIT_CODES.VULNS_FOUND : error.code;
  } else {
    const noSupportedManifestsFound = error.message?.includes(
      'Could not detect supported target files in',
    );
    const noSupportedSastFiles = error instanceof NoSupportedSastFiles;
    const noSupportedIaCFiles = error.code === IaCErrorCodes.NoFilesToScanError;
    const noSupportedProjectsDetected =
      noSupportedManifestsFound || noSupportedSastFiles || noSupportedIaCFiles;

    if (noSupportedProjectsDetected) {
      exitCode = EXIT_CODES.NO_SUPPORTED_PROJECTS_DETECTED;
    }

    if (vulnsFound) {
      // this isn't a bad command, so we won't record it as such
      command = args.command;
      exitCode = EXIT_CODES.VULNS_FOUND;
    }
  }

  if (args.options.debug && !args.options.json) {
    const output = vulnsFound ? error.message : error.stack;
    console.log(output);
  } else if (
    args.options.json &&
    !(error instanceof UnsupportedOptionCombinationError)
  ) {
    const output = vulnsFound
      ? error.message
      : stripAnsi(error.json || error.stack);
    if (error.jsonPayload) {
      new JsonStreamStringify(error.jsonPayload, undefined, 2).pipe(
        process.stdout,
      );
    } else {
      console.log(output);
    }
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

  if (error.jsonPayload) {
    // send raw jsonPayload instead of stringified payload
    await saveResultsToFile(args.options, 'json', '', error.jsonPayload);
  } else {
    // fallback to original behaviour
    await saveResultsToFile(args.options, 'json', error.jsonStringifiedResults);
  }
  await saveResultsToFile(args.options, 'sarif', error.sarifStringifiedResults);

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
    analytics.add('error', true);
    analytics.add('command', args.command);
  } else {
    analytics.add('error-message', analyticsError.message);
    // Note that error.stack would also contain the error message
    // (see https://nodejs.org/api/errors.html#errors_error_stack)
    analytics.add('error', analyticsError.stack);
    analytics.add('error-code', error.code);
    analytics.add('error-details', error.innerError);
    analytics.add('error-str-code', error.strCode);
    analytics.add('command', args.command);
  }

  const res = analytics.addDataAndSend({
    args: obfuscateArgs(args.options._),
    command,
    org: args.options.org,
  });

  return { res, exitCode };
}

function getFullPath(filepathFragment: string): string {
  if (pathLib.isAbsolute(filepathFragment)) {
    return filepathFragment;
  } else {
    const fullPath = pathLib.join(process.cwd(), filepathFragment);
    return fullPath;
  }
}

async function saveJsonResultsToFile(
  stringifiedJson: string,
  jsonOutputFile: string,
  jsonPayload?: Record<string, unknown>,
) {
  if (!jsonOutputFile) {
    console.error('empty jsonOutputFile');
    return;
  }

  if (jsonOutputFile.constructor.name !== String.name) {
    console.error('--json-output-file should be a filename path');
    return;
  }

  // save to file with jsonPayload object instead of stringifiedJson
  if (jsonPayload && !isEmpty(jsonPayload)) {
    await saveObjectToFile(jsonOutputFile, jsonPayload);
  } else {
    await saveJsonToFileCreatingDirectoryIfRequired(
      jsonOutputFile,
      stringifiedJson,
    );
  }
}

function checkRuntime() {
  if (!runtime.isSupported(process.versions.node)) {
    console.error(
      `Node.js version ${process.versions.node} is an unsupported Node.js ` +
        `runtime! Supported runtime range is '${runtime.supportedRange}'`,
    );
    console.error(
      'Please upgrade your Node.js runtime. The last version of Snyk CLI that supports Node.js v8 is v1.454.0.',
    );
    process.exit(EXIT_CODES.ERROR);
  }
}

type AllSupportedCliOptions = Options & MonitorOptions & TestOptions;

export async function main(): Promise<void> {
  checkRuntime();

  let res;
  let failed = false;
  let exitCode = EXIT_CODES.ERROR;
  try {
    modeValidation(globalArgs);
    // TODO: fix this, we do transformation to options and teh type doesn't reflect it
    validateUnsupportedOptionCombinations(
      globalArgs.options as unknown as AllSupportedCliOptions,
    );

    if (globalArgs.options['group-issues'] && globalArgs.options['iac']) {
      throw new UnsupportedOptionCombinationError([
        '--group-issues is currently not supported for Snyk IaC.',
      ]);
    }

    if (
      globalArgs.options['group-issues'] &&
      !globalArgs.options['json'] &&
      !globalArgs.options['json-file-output']
    ) {
      throw new UnsupportedOptionCombinationError([
        'JSON output is required to use --group-issues, try adding --json.',
      ]);
    }

    if (
      globalArgs.options['mavenAggregateProject'] &&
      globalArgs.options['project-name']
    ) {
      throw new UnsupportedOptionCombinationError([
        'maven-aggregate-project',
        'project-name',
      ]);
    }

    if (
      globalArgs.options.file &&
      typeof globalArgs.options.file === 'string' &&
      (globalArgs.options.file as string).match(/\.sln$/)
    ) {
      if (globalArgs.options['project-name']) {
        throw new UnsupportedOptionCombinationError([
          'file=*.sln',
          'project-name',
        ]);
      }
      sln.updateArgs(globalArgs);
    } else if (typeof globalArgs.options.file === 'boolean') {
      throw new FileFlagBadInputError();
    }

    if (
      typeof globalArgs.options.detectionDepth !== 'undefined' &&
      (globalArgs.options.detectionDepth <= 0 ||
        Number.isNaN(globalArgs.options.detectionDepth))
    ) {
      throw new InvalidDetectionDepthValue();
    }

    validateUnsupportedSarifCombinations(globalArgs);

    validateOutputFile(
      globalArgs.options,
      'json',
      new JsonFileOutputBadInputError(),
    );
    validateOutputFile(
      globalArgs.options,
      'sarif',
      new SarifFileOutputEmptyError(),
    );

    res = await runCommand(globalArgs);
  } catch (error) {
    failed = true;

    const response = await handleError(globalArgs, error);
    res = response.res;
    exitCode = response.exitCode;
  }

  if (!globalArgs.options.json) {
    const alertsMessage = alerts.displayAlerts();
    if (alertsMessage) {
      console.warn(alertsMessage);
    }
  }

  if (!process.env.TAP && failed) {
    debug('Exit code: ' + exitCode);
    process.exitCode = exitCode;
  }

  return res;
}

function validateUnsupportedOptionCombinations(
  options: AllSupportedCliOptions,
): void {
  const unsupportedAllProjectsCombinations: {
    [name: string]: SupportedUserReachableFacingCliArgs;
  } = {
    'project-name': 'project-name',
    file: 'file',
    yarnWorkspaces: 'yarn-workspaces',
    packageManager: 'package-manager',
    docker: 'docker',
    allSubProjects: 'all-sub-projects',
  };

  const unsupportedYarnWorkspacesCombinations: {
    [name: string]: SupportedUserReachableFacingCliArgs;
  } = {
    'project-name': 'project-name',
    file: 'file',
    packageManager: 'package-manager',
    docker: 'docker',
    allSubProjects: 'all-sub-projects',
  };

  if (options.scanAllUnmanaged && options.file) {
    throw new UnsupportedOptionCombinationError(['file', 'scan-all-unmanaged']);
  }

  if (options.allProjects) {
    for (const option in unsupportedAllProjectsCombinations) {
      if (options[option]) {
        throw new UnsupportedOptionCombinationError([
          unsupportedAllProjectsCombinations[option],
          'all-projects',
        ]);
      }
    }
  }

  if (options.yarnWorkspaces) {
    for (const option in unsupportedYarnWorkspacesCombinations) {
      if (options[option]) {
        throw new UnsupportedOptionCombinationError([
          unsupportedAllProjectsCombinations[option],
          'yarn-workspaces',
        ]);
      }
    }
  }

  if (options.exclude) {
    if (!(options.allProjects || options.yarnWorkspaces)) {
      throw new MissingOptionError('--exclude', [
        '--yarn-workspaces',
        '--all-projects',
      ]);
    }
    if (typeof options.exclude !== 'string') {
      throw new ExcludeFlagBadInputError();
    }
    if (options.exclude.indexOf(pathLib.sep) > -1) {
      throw new ExcludeFlagInvalidInputError();
    }
  }
}

function validateUnsupportedSarifCombinations(args) {
  if (args.options['json-file-output'] && args.command !== 'test') {
    throw new UnsupportedOptionCombinationError([
      args.command,
      'json-file-output',
    ]);
  }

  if (args.options['sarif'] && args.command !== 'test') {
    throw new UnsupportedOptionCombinationError([args.command, 'sarif']);
  }

  if (args.options['sarif'] && args.options['json']) {
    throw new UnsupportedOptionCombinationError([
      args.command,
      'sarif',
      'json',
    ]);
  }

  if (args.options['sarif-file-output'] && args.command !== 'test') {
    throw new UnsupportedOptionCombinationError([
      args.command,
      'sarif-file-output',
    ]);
  }
}

async function saveResultsToFile(
  options: ArgsOptions,
  outputType: string,
  jsonResults: string,
  jsonPayload?: Record<string, unknown>,
) {
  const flag = `${outputType}-file-output`;
  const outputFile = options[flag];
  if (outputFile && (jsonResults || !isEmpty(jsonPayload))) {
    const outputFileStr = outputFile as string;
    const fullOutputFilePath = getFullPath(outputFileStr);
    await saveJsonResultsToFile(
      stripAnsi(jsonResults),
      fullOutputFilePath,
      jsonPayload,
    );
  }
}

function validateOutputFile(
  options: ArgsOptions,
  outputType: string,
  error: CustomError,
) {
  const fileOutputValue = options[`${outputType}-file-output`];

  if (fileOutputValue === undefined) {
    return;
  }

  if (!fileOutputValue || typeof fileOutputValue !== 'string') {
    throw error;
  }
  // On Windows, seems like quotes get passed in
  if (fileOutputValue === "''" || fileOutputValue === '""') {
    throw error;
  }
}
