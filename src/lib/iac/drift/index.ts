import * as debugLib from 'debug';
import * as child_process from 'child_process';
import { cachePath, findOrDownload } from './executable';
import { createIfNotExists } from './util';

const debug = debugLib('drift');

enum DriftctlCmd {
  GenDriftIgnore = 'gen-driftignore',
}

const supportedDriftctlCommands: string[] = [DriftctlCmd.GenDriftIgnore];

export interface DriftctlGenDriftIgnoreOptions {
  input?: string;
  output?: string;
  'exclude-changed'?: boolean;
  'exclude-missing'?: boolean;
  'exclude-unmanaged'?: boolean;
}

interface DriftCTLOptions {
  quiet?: true;
  filter?: string;
  to?: string;
  headers?: string;
  'tfc-token'?: string;
  'tfc-endpoint'?: string;
  'tf-provider-version'?: string;
  strict?: true;
  deep?: true;
  driftignore?: string;
  'tf-lockfile'?: string;
  'config-dir'?: string;
  from?: string; // TODO We only handle one from at a time due to snyk cli arg parsing
  json?: boolean;
  'json-file-output'?: string;
  html?: boolean;
  'html-file-output'?: string;
}

export function parseArgs(
  commands: string[],
  options: DriftCTLOptions | DriftctlGenDriftIgnoreOptions,
): string[] {
  const args: string[] = commands;

  const driftctlCommand = args[0];
  if (!supportedDriftctlCommands.includes(driftctlCommand)) {
    throw new Error(`Unsupported command: ${driftctlCommand}`);
  }

  // It is currently not possible to iterate on options and pass everything
  // to the args since there is snyk CLI related data on it.
  // We can try to switch the logic from a whitelist approch to a blacklist apporoach
  // But if something change from the snyk cli options parsing sub command will fail
  // For now it's better to keep the control on that even if mean that we'll need to update theses methods every time
  // we make change on arguments in driftctl
  switch (driftctlCommand) {
    case DriftctlCmd.GenDriftIgnore:
      args.push(
        ...parseGenDriftIgnoreFlags(options as DriftctlGenDriftIgnoreOptions),
      );
      break;
  }

  debug(args);

  return args;
}

const parseGenDriftIgnoreFlags = (
  options: DriftctlGenDriftIgnoreOptions,
): string[] => {
  const args: string[] = [];

  if (options.input) {
    args.push('--input');
    args.push(options.input);
  }

  if (options.output) {
    args.push('--output');
    args.push(options.output);
  }

  if (options['exclude-changed']) {
    args.push('--exclude-changed');
  }

  if (options['exclude-missing']) {
    args.push('--exclude-missing');
  }

  if (options['exclude-unmanaged']) {
    args.push('--exclude-unmanaged');
  }

  return args;
};

export const parseDescribeFlags = (options: DriftCTLOptions): string[] => {
  const args: string[] = ['scan'];

  if (options.quiet) {
    args.push('--quiet');
  }

  if (options.filter) {
    args.push('--filter');
    args.push(options.filter);
  }

  if (options.json) {
    args.push('--output');
    args.push('json://stdout');
  }

  if (options['json-file-output']) {
    args.push('--output');
    args.push('json://' + options['json-file-output']);
  }

  if (options.html) {
    args.push('--output');
    args.push('html://stdout');
  }

  if (options['html-file-output']) {
    args.push('--output');
    args.push('html://' + options['html-file-output']);
  }

  if (options.headers) {
    args.push('--headers');
    args.push(options.headers);
  }

  if (options['tfc-token']) {
    args.push('--tfc-token');
    args.push(options['tfc-token']);
  }

  if (options['tfc-endpoint']) {
    args.push('--tfc-endpoint');
    args.push(options['tfc-endpoint']);
  }

  if (options['tf-provider-version']) {
    args.push('--tf-provider-version');
    args.push(options['tf-provider-version']);
  }

  if (options.strict) {
    args.push('--strict');
  }

  if (options.deep) {
    args.push('--deep');
  }

  if (options.driftignore) {
    args.push('--driftignore');
    args.push(options.driftignore);
  }

  if (options['tf-lockfile']) {
    args.push('--tf-lockfile');
    args.push(options['tf-lockfile']);
  }

  let configDir = cachePath;
  createIfNotExists(cachePath);
  if (options['config-dir']) {
    configDir = options['config-dir'];
  }
  args.push('--config-dir');
  args.push(configDir);

  if (options.from) {
    args.push('--from');
    args.push(options.from);
  }

  let to = 'aws+tf';
  if (options.to) {
    to = options.to;
  }
  args.push('--to');
  args.push(to);

  return args;
};

export async function runDriftctl(args: string[]): Promise<number> {
  debug('running driftctl %s ', args.join(' '));
  const driftctlPath = await findOrDownload();
  return new Promise<number>((resolve, reject) => {
    const driftctlProc = child_process.spawn(driftctlPath, args, {
      stdio: 'pipe',
    });

    let stdout = '';
    driftctlProc.stdout.on('data', function(output) {
      stdout += output;
    });

    let stderr = '';
    driftctlProc.stderr.on('data', function(output) {
      stderr += output;
    });

    driftctlProc.on('error', (error) => {
      reject(error);
    });

    driftctlProc.on('exit', (code) => {
      console.error(stderr);
      console.log(stdout);
      if (code == null) {
        // process was terminated by a signal
        // https://nodejs.org/api/child_process.html#event-exit
        reject(new Error('Process was terminated'));
      } else {
        resolve(code);
      }
    });
  });
}
