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

const cachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
const debug = debugLib('drift');

export const driftctlVersion = 'v0.21.0';
const driftctlChecksums = {
  'driftctl_windows_386.exe':
    'f7affbe0ba270b0339d0398befc686bd747a1694a4db0890ce73a2b1921521d4',
  driftctl_darwin_amd64:
    '85cd7a0b5670aa0ee52181357ec891f5a84df29cf505344e403b8b9de5953d61',
  driftctl_linux_386:
    '4221b4f2db65163ccfd300f90fe7cffa7bac1f806f56971ebbca5e36269aa3a4',
  driftctl_linux_amd64:
    'eb64c0d7a7094f0d741abae24c59a46db3eb76f619f177fd745efea7d468a66e',
  driftctl_linux_arm64:
    'c0c4dbfb2f5217124d3f7e1ef33b8b547fc84adf65612aca438e48e63da2f63e',
  'driftctl_windows_arm64.exe':
    '9e87c2a7fecca5a2846c87d4c570b5357e892e4234d7eafa0dac5ea31142e992',
  driftctl_darwin_arm64:
    '39813b4f05c034b6833508062f72bc17f1edbe2bc4db244893e75198eb013a34',
  'driftctl_windows_arm.exe':
    '5d66cb4db95bfa33d4946d324c4674f10fde8370dfb5003d99242a560d8e7e1b',
  driftctl_linux_arm:
    '13705de80f0de3d1a931e81947cc7a443dcec59968bafcb8ea888a4f643e5605',
  'driftctl_windows_amd64.exe':
    '154afbf87a3c0d36a345ccadad8ca7f85855a1c1f8f622ce1ea46931dadafce7',
};

const dctlBaseUrl = 'https://github.com/snyk/driftctl/releases/download/';
const driftctlPath = path.join(cachePath, 'driftctl_' + driftctlVersion);

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
  json?: boolean;
  'json-file-output'?: string;
  html?: boolean;
  'html-file-output'?: string;
  service?: string;
  from?: string; // snyk cli args parsing does not support variadic args so this will be coma separated values
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
