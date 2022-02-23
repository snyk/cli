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

const cachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
const debug = debugLib('drift');

export const driftctlVersion = 'v0.19.0';
const driftctlChecksums = {
  'driftctl_windows_386.exe':
    '0336132cc0c24beaef2535e0a129d146c1a267f6296d5d6bcc7fbe0b02f0bc78',
  driftctl_darwin_amd64:
    '07eae8f9e537183031bb78203c1c50a0ca80e114716598946b76baadcbca2656',
  driftctl_linux_386:
    '4b83a5644ce72d3eabd915ffc1bba13ad1d61914984801800f598b35db2fe054',
  driftctl_linux_amd64:
    '4bfd536e2123667e01b6e5d54acc27733be0db5a00b7fda7f41fabcd9e910e1d',
  driftctl_linux_arm64:
    '50bbf8f47ec7dcb9cc09a628444b093a0305aa9b4accc84b7c366a2297390881',
  'driftctl_windows_arm64.exe':
    '6eee390fb97998f309ff0491b893d8727f90f45b98f42fd1aa3ebef29fd7fc5b',
  driftctl_darwin_arm64:
    '6f37d9f2e385ef81adea9a1f68f2c85f859608dd854416d8ecf629e626bc8b0c',
  'driftctl_windows_arm.exe':
    '7ce916deaad289f41c874a4ddff41e9e6195cd5f78821a5769f8e66434be5465',
  driftctl_linux_arm:
    'a73193472fb33744f0a344a5f3a5663bd0f4791c393a68ea1b4c219b02eda8f1',
  'driftctl_windows_amd64.exe':
    'be423648c164f816ea98eae9694aa7c6679d0a6c33305aceb435cd75821bc730',
};

const dctlBaseUrl = 'https://github.com/snyk/driftctl/releases/download/';
const driftctlPath = path.join(cachePath, 'driftctl_' + driftctlVersion);

enum DriftctlCmd {
  Scan = 'scan',
  GenDriftIgnore = 'gen-driftignore',
}

const supportedDriftctlCommands: string[] = [
  DriftctlCmd.Scan,
  DriftctlCmd.GenDriftIgnore,
];

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
  output?: string;
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
      args.push(...parseGenDriftIgnoreFlags(options));
      break;
    case DriftctlCmd.Scan:
      args.push(...parseScanFlags(options));
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

const parseScanFlags = (options: DriftCTLOptions): string[] => {
  const args: string[] = [];

  if (options.quiet) {
    args.push('--quiet');
  }

  if (options.filter) {
    args.push('--filter');
    args.push(options.filter);
  }

  if (options.output) {
    args.push('--output');
    args.push(options.output);
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

export async function driftctl(args: string[]): Promise<number> {
  debug('running driftctl %s ', args.join(' '));

  const path = await findOrDownload();

  return await launch(path, args);
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
