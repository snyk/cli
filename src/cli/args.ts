import * as abbrev from 'abbrev';
import { MethodResult } from './commands/types';

import * as debugModule from 'debug';
import { parseMode, displayModeHelp } from './modes';
import {
  SupportedCliCommands,
  SupportedUserReachableFacingCliArgs,
} from '../lib/types';
import { getContainerImageSavePath } from '../lib/container';
import { obfuscateArgs } from '../lib/utils';

export declare interface Global extends NodeJS.Global {
  ignoreUnknownCA: boolean;
}

declare const global: Global;

const alias = abbrev(
  'copy',
  'version',
  'debug',
  'help',
  'quiet',
  'interactive',
  'dev',
);
alias.d = 'debug'; // always make `-d` debug
alias.t = 'test';
alias.p = 'prune-repeated-subdependencies';

// The -d flag enables printing the messages for predefined namespaces.
// Additional ones can be specified (comma-separated) in the DEBUG environment variable.
const DEBUG_DEFAULT_NAMESPACES = [
  'snyk-test',
  'snyk',
  'snyk-code',
  'snyk:find-files',
  'snyk:run-test',
  'snyk:prune',
  'snyk-nodejs-plugin',
  'snyk-gradle-plugin',
  'snyk-sbt-plugin',
  'snyk-mvn-plugin',
  'snyk-yarn-workspaces',
  'snyk-java-call-graph-builder',
];

// NOTE[muscar] This is accepted in seconds for UX reasons, the maven plugin
// turns it into milliseconds before calling the call graph generator
const REACHABLE_VULNS_TIMEOUT = 5 * 60; // 5 min (in seconds)

function dashToCamelCase(dash) {
  return dash.indexOf('-') < 0
    ? dash
    : dash.replace(/-[a-z]/g, (m) => m[1].toUpperCase());
}

// Last item is ArgsOptions, the rest are strings (positional arguments, e.g. paths)
export type MethodArgs = Array<string | ArgsOptions>;

export interface Args {
  command: string;
  method: (...args: MethodArgs) => Promise<MethodResult>; // command resolved to a function
  options: ArgsOptions;
}

export interface ArgsOptions {
  // all arguments after a '--' are taken as is and passed to the next process
  // (see the snyk-mvn-plugin or snyk-gradle-plugin)
  _doubleDashArgs: string[];
  _: MethodArgs;
  rawArgv: string[];
  [key: string]: boolean | string | number | MethodArgs | string[]; // The two last types are for compatibility only
}

export function args(rawArgv: string[]): Args {
  const argv = {
    _: [] as string[],
    rawArgv,
  } as ArgsOptions;

  for (let arg of rawArgv.slice(2)) {
    if (argv._doubleDashArgs) {
      argv._doubleDashArgs.push(arg);
    } else if (arg === '--') {
      argv._doubleDashArgs = [];
    } else if (arg[0] === '-') {
      arg = arg.slice(1);

      if (alias[arg] !== undefined) {
        argv[alias[arg]] = true;
      } else if (arg[0] === '-') {
        arg = arg.slice(1);
        if (arg.indexOf('=') === -1) {
          argv[arg] = true;
        } else {
          const parts = arg.split('=');
          argv[parts.shift()!] = parts.join('=');
        }
      } else {
        argv[arg] = true;
      }
    } else {
      argv._.push(arg);
    }
  }

  // By passing `-d` to the CLI, we enable the debugging output.
  // It needs to happen BEFORE any of the `debug(namespace)` calls needed to create loggers.
  // Therefore, the code used by the CLI should create the loggers in a lazy fashion
  // or be `require`d after this code.
  // TODO(BST-648): sort this out reliably
  if (argv.debug) {
    let enable = DEBUG_DEFAULT_NAMESPACES.join(',');
    if (process.env.DEBUG) {
      enable += ',' + process.env.DEBUG;
    }

    // Storing in the global state, because just "debugModule.enable" call won't affect different instances of `debug`
    // module imported by plugins, libraries etc.
    process.env.DEBUG = enable;

    debugModule.enable(enable);
  }

  const debug = debugModule('snyk');

  // Late require, see the note re "debug" option above.
  const cli = require('./commands');

  // the first argument is the command we'll execute, everything else will be
  // an argument to our command, like `snyk help protect`
  let command = argv._.shift() as string; // can actually be undefined

  // snyk [mode?] [command] [paths?] [options-double-dash]
  command = displayModeHelp(command, argv);
  command = parseMode(command, argv);

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

    // If command has a value prior to running it over with “help” and argv.help contains "help", save the command in argv._
    // so that no argument gets deleted or ignored. This ensures `snyk --help [command]` and `snyk [command] --help` return the
    // specific help page instead of the generic one.
    // This change also covers the scenario of 'snyk [mode] [command] --help' and 'snyk --help [mode] [command]`.
    if (!argv._.length) {
      command && argv.help === 'help'
        ? argv._.unshift(command)
        : argv._.unshift((argv.help as string) || 'help');
    }
    command = 'help';
  }

  if (command && command.indexOf('config:') === 0) {
    // config looks like `config:set x=y` or `config:get x`
    // so we need to mangle the commands into this format:
    // snyk.config('set', 'api=x')
    // snyk.config('get', 'api') // etc
    const tmp = command.split(':');
    command = tmp.shift()!;
    argv._.unshift(tmp.shift()!);
  }

  let method: () => Promise<MethodResult> = cli[command];

  if (!method) {
    // if we failed to find a command, then default to an error
    method = require('../lib/errors/legacy-errors');
    argv._.push(command);
  }

  // TODO: Once experimental flag became default this block should be
  // moved to inside the parseModes function for container mode
  const imageSavePath = getContainerImageSavePath();
  if (imageSavePath) {
    argv['imageSavePath'] = imageSavePath;
  }

  if (command in SupportedCliCommands) {
    // copy all the options across to argv._ as an object
    argv._.push(argv);
  }

  // TODO: eventually all arguments should be transformed like this.
  const argumentsToTransform: Array<Partial<
    SupportedUserReachableFacingCliArgs
  >> = [
    'package-manager',
    'packages-folder',
    'severity-threshold',
    'strict-out-of-sync',
    'all-sub-projects',
    'sub-project',
    'gradle-sub-project',
    'gradle-accept-legacy-config-roles',
    'skip-unresolved',
    'scan-all-unmanaged',
    'fail-on',
    'all-projects',
    'yarn-workspaces',
    'detection-depth',
    'reachable',
    'reachable-vulns',
    'reachable-timeout',
    'reachable-vulns-timeout',
    'init-script',
    'integration-name',
    'integration-version',
    'prune-repeated-subdependencies',
    'dry-run',
    'sequential',
  ];
  for (const dashedArg of argumentsToTransform) {
    if (argv[dashedArg]) {
      const camelCased = dashToCamelCase(dashedArg);
      if (camelCased === dashedArg) {
        continue;
      }
      argv[camelCased] = argv[dashedArg];
      delete argv[dashedArg];
    }
  }

  if (argv.detectionDepth !== undefined) {
    argv.detectionDepth = Number(argv.detectionDepth);
  }

  if (argv.skipUnresolved !== undefined) {
    if (argv.skipUnresolved === 'false') {
      argv.allowMissing = false;
    } else {
      argv.allowMissing = true;
    }
  }

  if (argv.strictOutOfSync !== undefined) {
    if (argv.strictOutOfSync === 'false') {
      argv.strictOutOfSync = false;
    } else {
      argv.strictOutOfSync = true;
    }
  }

  if (
    (argv.reachableVulns || argv.reachable) &&
    argv.reachableTimeout === undefined &&
    argv.reachableVulnsTimeout === undefined
  ) {
    argv.reachableVulnsTimeout = REACHABLE_VULNS_TIMEOUT.toString();
  }

  // Alias
  const aliases = {
    gradleSubProject: 'subProject',
    container: 'docker',
    reachable: 'reachableVulns',
    reachableTimeout: 'callGraphBuilderTimeout',
    reachableVulnsTimeout: 'callGraphBuilderTimeout',
  };
  for (const argAlias in aliases) {
    if (argv[argAlias]) {
      const target = aliases[argAlias];
      argv[target] = argv[argAlias];
      delete argv[argAlias];
    }
  }

  if (argv.insecure) {
    global.ignoreUnknownCA = true;
  }

  debug(command, obfuscateArgs(argv));

  return {
    command,
    method,
    options: argv,
  };
}
