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

const cachePath = config.CACHE_PATH ?? envPaths('snyk').cache;
const debug = debugLib('drift');

export const DCTL_EXIT_CODES = {
  EXIT_IN_SYNC: 0,
  EXIT_NOT_IN_SYNC: 1,
  EXIT_ERROR: 2,
};

// ⚠ Keep in mind to also update driftctl version used to generate docker images
// You can edit base image used for snyk final image here https://github.com/snyk/snyk-images/blob/master/alpine
export const driftctlVersion = 'v0.23.0';
const driftctlChecksums = {
  'driftctl_windows_386.exe':
    'e5befbafe2291674a4d6c8522411a44fea3549057fb46d331402d49b180202fe',
  driftctl_darwin_amd64:
    '9af4e88a8e08e53ac3c373407bdd0b18a91941dc620266349f10600fc7b283d2',
  driftctl_linux_386:
    '6cd2719f81210017e3f67677cb92f4b0060976a3588c220b4af6b2dda174df8f',
  driftctl_linux_amd64:
    'd714a3d11056169f4c4cc047b48b4d732f5df8cdfbc00e40c3e5f6e6cc5ead3e',
  driftctl_linux_arm64:
    '24812c8b2ec2d8e3d619317e76fbba0d8e7e263fc2c26cba26265a9656e8fe91',
  'driftctl_windows_arm64.exe':
    'd84461f0ba63b59aec66393fa67147f4157b5bddc02a19315d737c5f5a46c07b',
  driftctl_darwin_arm64:
    'b711143d9331a10fc34c202284f67ce5eeb0348baca546b47af139f418f812c1',
  'driftctl_windows_arm.exe':
    'b5d24e1407c24ddfff63ffbba85eb1dc13473e2fd36e3e99e5e1762cf615f011',
  driftctl_linux_arm:
    '089665efa8a7c5e95b3cee9ace85fc5b0f2d7f2a29c351f2d3dbef3dae553e2d',
  'driftctl_windows_amd64.exe':
    'bf7310277eeccc2679b529c1f1d2ced30e877949a6d7c5606eb2d4c2ec033b66',
};

const dctlBaseUrl = 'https://github.com/snyk/driftctl/releases/download/';
const driftctlPath = path.join(cachePath, 'driftctl_' + driftctlVersion);
const driftctlDefaultOptions = ['--no-version-check'];
let isBinaryDownloaded = false;

export const generateArgs = (options: DriftCTLOptions): string[] => {
  if (options.kind === 'describe') {
    return generateScanFlags(options as DescribeOptions);
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

const generateScanFlags = (options: DescribeOptions): string[] => {
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

  if (options.ignore && options.ignore.length > 0) {
    args.push('--ignore');
    args.push(options.ignore.join(','));
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
  input,
  stdio,
}: {
  options: DriftCTLOptions;
  input?: string;
  stdio?: StdioOptions;
}): Promise<DriftctlExecutionResult> => {
  const path = await findOrDownload();
  const args = generateArgs(options);

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

  // lookup in /bin
  // when used in a docker context the default binary path should be used
  {
    dctlPath = '/bin/driftctl';
    const exists = await isExe(dctlPath);
    if (exists) {
      debug('Found driftctl in %s', dctlPath);
      return dctlPath;
    }
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
