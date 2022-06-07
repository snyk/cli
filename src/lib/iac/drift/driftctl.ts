import config from '../../config';
import { EXIT_CODES } from '../../../cli/exit-codes';
import envPaths from 'env-paths';
import {
  DescribeOptions,
  DriftctlExecutionResult,
  DriftCTLOptions,
  FmtOptions,
} from '../types';
import { TimerMetricInstance } from '../../metrics';
import * as analytics from '../../analytics';
import { spinner } from '../../spinner';
import {
  createIgnorePattern,
  verifyServiceMappingExists,
} from '../service-mappings';
import { validateArgs } from '../drift';
import * as debugLib from 'debug';
import { makeRequest } from '../../request';
import { StdioOptions } from 'child_process';
import * as path from 'path';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

const debug = debugLib('driftctl');

const cachePath = config.CACHE_PATH ?? envPaths('snyk').cache;

export const DCTL_EXIT_CODES = {
  EXIT_IN_SYNC: 0,
  EXIT_NOT_IN_SYNC: 1,
  EXIT_ERROR: 2,
};

export const driftctlVersion = 'v0.32.0';

const driftctlChecksums = {
  'driftctl_windows_386.exe':
    '01e466194743a0de29cf5eb89f7a9d664cf10ef7a54fd7caa5d8d548284ad7c4',
  driftctl_darwin_amd64:
    'd75466d438dafc694accb12a88cbcab023abda70de3534f96b32a33584206bd5',
  driftctl_linux_386:
    'dd5c067b69bafe7d9eb99a9fad69f85b5ce30be072840f37dcd5313c508da2d9',
  driftctl_linux_amd64:
    '8bbde304a5fca2814b5ccdd2c58d7e09607bcd31ef2cbfacede57326da5a9a53',
  driftctl_linux_arm64:
    'ec34390073d4625e281bc8d2ae1204ad5a01c4ebd358ffc64964bce20fc4442c',
  'driftctl_windows_arm64.exe':
    '859202bacc72340661fd70bd29fce7655867f90569b0dc172c1de5a31eb8f132',
  driftctl_darwin_arm64:
    'a814a65a9a96c92df66c95b3be9df1e84705a73e70a0077ebd67dccfd079f5f4',
  'driftctl_windows_arm.exe':
    '10e4c2299be45415a61985ae6eda7f09435567906070a443c2b6dd8a97370375',
  driftctl_linux_arm:
    '72ebfeba1345e737b95d9774b4ed1817dff3f077a88d48e7daed5c3006fcf100',
  'driftctl_windows_amd64.exe':
    '37ea51a796bca18f34f9f980c2ae6f43ff89bc3172969ae5af29096744dda5a0',
};

const dctlBaseUrl = 'https://static.snyk.io/cli/driftctl/';

const driftctlPath: string = path.join(
  cachePath,
  'driftctl_' + driftctlVersion,
);

const driftctlDefaultOptions = ['--no-version-check'];

let isBinaryDownloaded = false;

export const generateArgs = (
  options: DriftCTLOptions,
  driftIgnore?: string[],
): string[] => {
  if (options.kind === 'describe') {
    return generateScanFlags(options as DescribeOptions, driftIgnore);
  }

  if (options.kind === 'fmt') {
    return generateFmtFlags(options as FmtOptions);
  }

  throw 'Unsupported command';
};

const generateFmtFlags = (options: FmtOptions): string[] => {
  const args: string[] = ['fmt', ...driftctlDefaultOptions];

  if (options.json) {
    args.push('--output');
    args.push('json://stdout');
  }

  if (options.html) {
    args.push('--output');
    args.push('html://stdout');
  }

  if (options['html-file-output']) {
    args.push('--output');
    args.push('html://' + options['html-file-output']);
  }

  return args;
};

const generateScanFlags = (
  options: DescribeOptions,
  driftIgnore?: string[],
): string[] => {
  const args: string[] = ['scan', ...driftctlDefaultOptions];

  if (options.quiet) {
    args.push('--quiet');
  }

  if (options.filter) {
    args.push('--filter');
    args.push(options.filter);
  }

  args.push('--output');
  args.push('json://stdout');

  if (options['fetch-tfstate-headers']) {
    args.push('--headers');
    args.push(options['fetch-tfstate-headers']);
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

  if (options.deep || options.all) {
    args.push('--deep');
  }

  if (options['only-managed'] || options.drift) {
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

  if (driftIgnore && driftIgnore.length > 0) {
    args.push('--ignore');
    args.push(driftIgnore.join(','));
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

export function translateExitCode(exitCode: number | null): number {
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

export const runDriftCTL = async ({
  options,
  driftIgnore,
  input,
  stdio,
}: {
  options: DriftCTLOptions;
  driftIgnore?: string[];
  input?: string;
  stdio?: StdioOptions;
}): Promise<DriftctlExecutionResult> => {
  const path = await findOrDownload();
  await validateArgs(options);
  const args = generateArgs(options, driftIgnore);

  if (!stdio) {
    stdio = ['pipe', 'pipe', 'inherit'];
  }

  debug('running driftctl %s ', args.join(' '));

  const p = child_process.spawn(path, args, {
    stdio,
    env: { ...process.env, DCTL_IS_SNYK: 'true' },
  });

  let stdout = '';
  return new Promise<DriftctlExecutionResult>((resolve, reject) => {
    if (input) {
      p.stdin?.write(input);
      p.stdin?.end();
    }
    p.on('error', (error) => {
      reject(error);
    });

    p.stdout?.on('data', (data) => {
      stdout += data;
    });

    p.on('exit', (code) => {
      resolve({ code: translateExitCode(code), stdout });
    });
  });
};

async function findOrDownload(): Promise<string> {
  let dctl = await findDriftCtl();
  if (isBinaryDownloaded) {
    return dctl;
  }
  let downloadDuration = 0;
  let binaryExist = true;
  if (dctl === '') {
    binaryExist = false;
    try {
      createIfNotExists(cachePath);
      dctl = driftctlPath;

      const duration = new TimerMetricInstance('driftctl_download');
      duration.start();
      await download(driftctlUrl(), dctl);
      duration.stop();

      downloadDuration = Math.round((duration.getValue() as number) / 1000);
    } catch (err) {
      return Promise.reject(err);
    }
  }
  analytics.add('iac-drift-binary-already-exist', binaryExist);
  analytics.add('iac-drift-binary-download-duration-seconds', downloadDuration);
  isBinaryDownloaded = true;
  return dctl;
}

async function findDriftCtl(): Promise<string> {
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
