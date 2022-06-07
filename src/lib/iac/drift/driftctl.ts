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

export const driftctlVersion = 'v0.32.1';

const driftctlChecksums = {
  'driftctl_windows_386.exe':
    '225de60d9179dda00780df18f168473bfc30d23222bbf87aa9ee856d65e995cf',
  driftctl_darwin_amd64:
    'd8665a9d9eab5254447053e5a35be93ef6d5f42069e1b5b4083d4503cd79f572',
  driftctl_linux_386:
    '2469606111d599f5d72970acfccfa75ef43635c31bb4547a071514e91318ad4b',
  driftctl_linux_amd64:
    'd262961eb6ee005dd65d8ad481801d3b4d30184a8b8aa03c370669729cab07a9',
  driftctl_linux_arm64:
    '1b04652ed21c137ec69ebf2cde2d771da3b59a6d2ddad0de31efd4375174a2b2',
  'driftctl_windows_arm64.exe':
    '03772784258c08a8ab6634a9801dcf7671f6648ab0f6b47a939e84364b468cb9',
  driftctl_darwin_arm64:
    'c04e520a9720abddb9e35b556497bd866abe7d2e0d34180ff5275cc45e0e383e',
  'driftctl_windows_arm.exe':
    '65c58c0495e4a0741216cb453e37774b17a615f02e532881e2b2473a2ac83c7c',
  driftctl_linux_arm:
    'd32125770fefe789695e939a9be39c371ec4e48a4743efe24edf90d4b1ee0aca',
  'driftctl_windows_amd64.exe':
    '46ab4c26231e01e336d35466136da72718ae51af35956875293c7f1e4e680307',
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
