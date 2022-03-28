import * as debugLib from 'debug';
import * as child_process from 'child_process';
import { StdioOptions } from 'child_process';
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
import {
  DescribeOptions,
  DriftAnalysis,
  DriftctlExecutionResult,
  DriftCTLOptions,
  FmtOptions,
  GenDriftIgnoreOptions,
} from './types';
import { TimerMetricInstance } from '../metrics';
import * as analytics from '../../lib/analytics';
import { Policy } from '../policy/find-and-load-policy';
import { DescribeExclusiveArgumentError } from '../errors/describe-exclusive-argument-error';
import { DescribeRequiredArgumentError } from '../errors/describe-required-argument-error';

const cachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
const debug = debugLib('drift');

export const DCTL_EXIT_CODES = {
  EXIT_IN_SYNC: 0,
  EXIT_NOT_IN_SYNC: 1,
  EXIT_ERROR: 2,
};

export const DescribeExclusiveArgs = [
  'all',
  'only-managed',
  'drift',
  'only-unmanaged',
];

export const DescribeRequiredArgs = [
  'all',
  'only-managed',
  'drift',
  'only-unmanaged',
];

export const driftctlVersion = 'v0.25.0';

const driftctlChecksums = {
  'driftctl_windows_386.exe':
    'ce0d01910c0522ba8b4e48ef4e13846d278b6af9a3d4119e686a9cb7197bd786',
  driftctl_darwin_amd64:
    '587eb76144a58ffb656740b18c163fdfc30f590744cae3f08d232c841b10f940',
  driftctl_linux_386:
    '73c56cbb8ad86e90bf349f67f5c62307fd0f976b964d8f10da3578124baff2f2',
  driftctl_linux_amd64:
    '6ec764a36571b19408d89b07cc7c601dc30e68712f3a5822fe81ea392230dcfc',
  driftctl_linux_arm64:
    '7168fa70ee5997d46ebf9c0aaaabb063e7d8acb2cb6de841e364281b6762b158',
  'driftctl_windows_arm64.exe':
    '432ff6d1ad0ad99f47d6482abf097fd999231f3f1df688c8bf6cdaa157c3b81b',
  driftctl_darwin_arm64:
    '16ce674a17fb1b2feab8a8fedcd2f3dca0d28fbce8e97dc351e51825c2a289ac',
  'driftctl_windows_arm.exe':
    '295b5a979f42aed83b163451950b35627533e63583de641a2bea5e8ada6e8ca7',
  driftctl_linux_arm:
    '634b61400733ea60e45e2ea57b8ede5083711e8615f61695ffe7ee2ec9a627dd',
  'driftctl_windows_amd64.exe':
    '4ef220ea8aaca51129086f69c0634d39fa99d50d965fe2ad3644d4f7e19e24f6',
};

const dctlBaseUrl = 'https://static.snyk.io/cli/driftctl/';
const driftctlPath = path.join(cachePath, 'driftctl_' + driftctlVersion);
const driftctlDefaultOptions = ['--no-version-check'];
let isBinaryDownloaded = false;

export const validateArgs = (options: DriftCTLOptions): void => {
  if (options.kind === 'describe') {
    return validateDescribeArgs(options as DescribeOptions);
  }
};

const validateDescribeArgs = (options: DescribeOptions): void => {
  // Check that there is no more than one of the exclusive arguments
  let count = 0;
  for (const describeExclusiveArg of DescribeExclusiveArgs) {
    if (options[describeExclusiveArg]) {
      count++;
    }
  }
  if (count > 1) {
    throw new DescribeExclusiveArgumentError();
  }

  // Check we have one of the required arguments
  count = 0;
  for (const describeRequiredArgs of DescribeRequiredArgs) {
    if (options[describeRequiredArgs]) {
      count++;
    }
  }
  if (count === 0) {
    throw new DescribeRequiredArgumentError();
  }
};

export const generateArgs = (
  options: DriftCTLOptions,
  driftIgnore?: string[],
): string[] => {
  if (options.kind === 'describe') {
    return generateScanFlags(options as DescribeOptions, driftIgnore);
  }

  if (options.kind === 'gen-driftignore') {
    return generateGenDriftIgnoreFlags(options as GenDriftIgnoreOptions);
  }

  if (options.kind === 'fmt') {
    return generateFmtFlags(options as FmtOptions);
  }

  throw 'Unsupported command';
};

export const generateGenDriftIgnoreFlags = (
  options: GenDriftIgnoreOptions,
): string[] => {
  const args: string[] = ['gen-driftignore', ...driftctlDefaultOptions];

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

const generateFmtFlags = (options: FmtOptions): string[] => {
  const args: string[] = ['fmt', ...driftctlDefaultOptions];

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

  if (options.deep) {
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

export const parseDriftAnalysisResults = (input: string): DriftAnalysis => {
  return JSON.parse(input) as DriftAnalysis;
};

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
  const args = await generateArgs(options, driftIgnore);

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

export function driftignoreFromPolicy(policy: Policy | undefined): string[] {
  const excludeSection = 'iac-drift';
  if (!policy || !policy.exclude || !(excludeSection in policy.exclude)) {
    return [];
  }
  return policy.exclude[excludeSection];
}
