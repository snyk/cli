import * as abbrev from 'abbrev';

import debugModule = require('debug');

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

// The -d flag enables printing the messages for predefined namespaces.
// Additional ones can be specified (comma-separated) in the DEBUG environment variable.
const DEBUG_DEFAULT_NAMESPACES = [
  'snyk',
  'snyk-gradle-plugin',
  'snyk-sbt-plugin',
];

function dashToCamelCase(dash) {
  return dash.indexOf('-') < 0
    ? dash
    : dash.replace(/-[a-z]/g, (m) => m[1].toUpperCase());
}

// Last item is ArgsOptions, the rest are strings (positional arguments, e.g. paths)
export type MethodArgs = Array<string | ArgsOptions>;

export type Method = (...args: MethodArgs) => Promise<string>;

export interface Args {
  command: string;
  method: Method; // command resolved to a function
  options: ArgsOptions;
}

export interface ArgsOptions {
  // all arguments after a '--' are taken as is and passed to the next process
  // (see the snyk-mvn-plugin or snyk-gradle-plugin)
  _doubleDashArgs: string[];
  _: MethodArgs;
  [key: string]: boolean | string | MethodArgs | string[]; // The two last types are for compatibility only
}

export function args(rawArgv: string[]): Args {
  const argv = {
    _: [] as string[],
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
      argv._.unshift((argv.help as string) || 'usage');
    }
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

  let method: () => Promise<string> = cli[command];

  if (!method) {
    // if we failed to find a command, then default to an error
    method = require('../lib/errors/legacy-errors');
    argv._.push(command);
  }

  // TODO decide why we can't do this cart blanche...
  if (
    [
      'protect',
      'test',
      'modules',
      'monitor',
      'wizard',
      'ignore',
      'woof',
    ].indexOf(command) !== -1
  ) {
    // copy all the options across to argv._ as an object
    argv._.push(argv);
  }

  // arguments that needs transformation from dash-case to camelCase
  // should be added here
  for (const dashedArg of [
    'package-manager',
    'packages-folder',
    'severity-threshold',
    'strict-out-of-sync',
    'all-sub-projects',
    'sub-project',
    'gradle-sub-project',
    'skip-unresolved',
  ]) {
    if (argv[dashedArg]) {
      const camelCased = dashToCamelCase(dashedArg);
      argv[camelCased] = argv[dashedArg];
      delete argv[dashedArg];
    }
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

  // Alias
  if (argv.gradleSubProject) {
    argv.subProject = argv.gradleSubProject;
    delete argv.gradleSubProject;
  }

  if (argv.insecure) {
    global.ignoreUnknownCA = true;
  }

  debug(command, argv);

  return {
    command,
    method,
    options: argv,
  };
}
