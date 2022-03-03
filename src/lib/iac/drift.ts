import * as debugLib from 'debug';
import * as child_process from 'child_process';
import * as os from 'os';
import envPaths from 'env-paths';
import * as fs from 'fs';
import { spinner } from '../spinner';
import { makeRequest } from '../request';
import config from '../../lib/config';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  createIgnorePattern,
  verifyServiceMappingExists,
} from './service-mappings';
import { EXIT_CODES } from '../../cli/exit-codes';

const cachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
const debug = debugLib('drift');

export const driftctlVersion = 'v0.22.0';

export const DCTL_EXIT_CODES = {
  EXIT_IN_SYNC: 0,
  EXIT_NOT_IN_SYNC: 1,
  EXIT_ERROR: 2,
};

const driftctlChecksums = {
  'driftctl_windows_386.exe':
    'bc51261061cea3d3c71d8ce9449e6f052b73d6faa98debe8d714362b30bdaa1f',
  driftctl_darwin_amd64:
    '8f268f57c5ba9e78f7c9f228bc7a4690b8d7671a721ef3adfa1e87da71a71c6f',
  driftctl_linux_386:
    'b4bbeffe76e0b5bd461e5034886dea1256b90e90136b6bdb8f4f89a4fd2ea792',
  driftctl_linux_amd64:
    '6bd0f400aa717dc44e860c59394901a1256177d06e1eba198ce5adc21aa64d60',
  driftctl_linux_arm64:
    '8e3bbff72db5105de3bfb203537ab47dbca5240db28192f12a5b032b33f8a1cc',
  'driftctl_windows_arm64.exe':
    '781dbc12bd6bdae32637fd1a69579f8744d72de702485f3068c81972cc6d5966',
  driftctl_darwin_arm64:
    '8ae04ef9cfc7ec364638e85a4e00e03484d6057b54dd51b17c3d51ebdd70cec5',
  'driftctl_windows_arm.exe':
    '039f5cfb5244c832ae1c2b6fcf25a4004a1abbd5b8a366030d9cd3832214136f',
  driftctl_linux_arm:
    'a71dfdb6a18af1d99e6234ab18a07b436c46f24939d4bab6357af4c18ce00987',
  'driftctl_windows_amd64.exe':
    '6084cce4a8753a7efa57c71ac56165d80011bfc21a16e07372981e8c004a636b',
};

const dctlBaseUrl = 'https://github.com/snyk/driftctl/releases/download/';
const driftctlPath = path.join(cachePath, 'driftctl_' + driftctlVersion);

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
  'only-managed'?: true;
  'only-unmanaged'?: true;
  driftignore?: string;
  'tf-lockfile'?: string;
  'config-dir'?: string;
  json?: boolean;
  'json-file-output'?: string;
  html?: boolean;
  'html-file-output'?: string;
  service?: string;
  from?: string; // snyk cli args parsing does not support variadic args so this will be coma separated values
}

export const parseGenDriftIgnoreFlags = (
  options: DriftctlGenDriftIgnoreOptions,
): string[] => {
  const args: string[] = ['gen-driftignore'];

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

  if (options['only-managed']) {
    args.push('--only-managed');
  }

  if (options['only-unmanaged']) {
    args.push('--only-unmanaged');
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
    const froms = options.from.split(',');
    for (const f of froms) {
      args.push('--from');
      args.push(f);
    }
  }

  let to = 'aws+tf';
  if (options.to) {
    to = options.to;
  }
  args.push('--to');
  args.push(to);

  if (options.service) {
    const services = options.service.split(',');
    verifyServiceMappingExists(services);
    args.push('--ignore');
    args.push(createIgnorePattern(services));
  }

  debug(args);

  return args;
};

export function translateExitCode(exitCode: number) {
  switch (exitCode) {
    case DCTL_EXIT_CODES.EXIT_IN_SYNC:
      return 0;
    case DCTL_EXIT_CODES.EXIT_NOT_IN_SYNC:
      return EXIT_CODES.VULNS_FOUND;
    case DCTL_EXIT_CODES.EXIT_ERROR:
      return EXIT_CODES.ERROR;
    default:
      debug('driftctl returned %d', exitCode);
      return EXIT_CODES.ERROR;
  }
}

export async function driftctl(args: string[]): Promise<number> {
  debug('running driftctl %s ', args.join(' '));

  const path = await findOrDownload();

  const exitCode = await launch(path, args);

  return translateExitCode(exitCode);
}

async function launch(path: string, args: string[]): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = child_process.spawn(path, args, { stdio: 'inherit' });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code == null) {
        //failed to find why this could happen...
        reject(new Error('Process was terminated'));
      } else {
        resolve(code);
      }
    });
  });
}

async function findOrDownload(): Promise<string> {
  let dctl = await findDriftCtl();
  if (dctl === '') {
    try {
      createIfNotExists(cachePath);
      dctl = driftctlPath;
      await download(driftctlUrl(), dctl);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  return dctl;
}

export async function findDriftCtl(): Promise<string> {
  // lookup in custom path contained in env var DRIFTCTL_PATH
  let dctlPath = config.DRIFTCTL_PATH;
  if (dctlPath != null) {
    const exists = await isExe(dctlPath);
    if (exists) {
      debug('Found driftctl in $DRIFTCTL_PATH: %s', dctlPath);
      return dctlPath;
    }
  }

  // lookup in app cache
  dctlPath = driftctlPath;
  const exists = await isExe(dctlPath);
  if (exists) {
    debug('Found driftctl in cache: %s', dctlPath);
    return dctlPath;
  }
  debug('driftctl not found');

  return '';
}

async function download(url, destination: string): Promise<boolean> {
  debug('downloading driftctl into %s', destination);

  const payload = {
    method: 'GET',
    url: url,
    output: destination,
    follow: 3,
  };

  await spinner('Downloading...');
  return new Promise<boolean>((resolve, reject) => {
    makeRequest(payload, function(err, res, body) {
      try {
        if (err) {
          reject(
            new Error('Could not download driftctl from ' + url + ': ' + err),
          );
          return;
        }
        if (res.statusCode !== 200) {
          reject(
            new Error(
              'Could not download driftctl from ' + url + ': ' + res.statusCode,
            ),
          );
          return;
        }

        validateChecksum(body);

        fs.writeFileSync(destination, body);
        debug('File saved: ' + destination);

        fs.chmodSync(destination, 0o744);
        resolve(true);
      } finally {
        spinner.clearAll();
      }
    });
  });
}

function validateChecksum(body: string) {
  // only validate if we downloaded the official driftctl binary
  if (config.DRIFTCTL_URL || config.DRIFTCTL_PATH) {
    return;
  }

  const computedHash = crypto
    .createHash('sha256')
    .update(body)
    .digest('hex');
  const givenHash = driftctlChecksums[driftctlFileName()];

  if (computedHash != givenHash) {
    throw new Error('Downloaded file has inconsistent checksum...');
  }
}

function driftctlFileName(): string {
  let platform = 'linux';
  switch (os.platform()) {
    case 'darwin':
      platform = 'darwin';
      break;
    case 'win32':
      platform = 'windows';
      break;
  }

  let arch = 'amd64';
  switch (os.arch()) {
    case 'ia32':
    case 'x32':
      arch = '386';
      break;
    case 'arm':
      arch = 'arm';
      break;
    case 'arm64':
      arch = 'arm64';
      break;
  }

  let ext = '';
  switch (os.platform()) {
    case 'win32':
      ext = '.exe';
      break;
  }

  return `driftctl_${platform}_${arch}${ext}`;
}

function driftctlUrl(): string {
  if (config.DRIFTCTL_URL) {
    return config.DRIFTCTL_URL;
  }

  return `${dctlBaseUrl}/${driftctlVersion}/${driftctlFileName()}`;
}

function isExe(dctlPath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    fs.access(dctlPath, fs.constants.X_OK, (err) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
}

function createIfNotExists(path: string) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}
