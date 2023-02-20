// must be set before we import 'global-agent/bootstrap'
process.env.GLOBAL_AGENT_ENVIRONMENT_VARIABLE_NAMESPACE = '';
process.env.HTTPS_PROXY =
  process.env.HTTPS_PROXY ?? process.env.https_proxy ?? '';
process.env.HTTP_PROXY = process.env.HTTP_PROXY ?? process.env.http_proxy ?? '';
process.env.NO_PROXY = process.env.NO_PROXY ?? process.env.no_proxy ?? '';

import 'global-agent/bootstrap';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import * as https from 'https';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import * as Sentry from '@sentry/node';

export const versionFile = path.join(__dirname, 'generated', 'version');
export const shasumFile = path.join(__dirname, 'generated', 'sha256sums.txt');

export class WrapperConfiguration {
  private version: string;
  private binaryName: string;
  private expectedSha256sum: string;

  public constructor(
    version: string,
    binaryName: string,
    expectedSha256sum: string,
  ) {
    this.version = version;
    this.binaryName = binaryName;
    this.expectedSha256sum = expectedSha256sum;
  }

  public getVersion(): string {
    return this.version;
  }

  public getBinaryName(): string {
    return this.binaryName;
  }

  public getDownloadLocation(): string {
    const baseUrl = 'https://static.snyk.io/cli/v';
    return baseUrl + this.version + '/' + this.binaryName;
  }

  public getLocalLocation(): string {
    const currentFolder = __dirname;
    return path.join(currentFolder, this.binaryName);
  }

  public getShasumFile(): string {
    return this.expectedSha256sum;
  }
}

export function determineBinaryName(platform: string, arch: string): string {
  let osname = platform;
  let archname = arch;

  switch (osname) {
    case 'win32':
      osname = 'windows';
      break;
    case 'linux': {
      let isAlpine = false;
      try {
        const result = spawnSync('cat /etc/os-release', { shell: true });
        isAlpine = result.stdout
          .toString()
          .toLowerCase()
          .includes('id=alpine');
      } catch {
        isAlpine = false;
      }

      if (isAlpine) {
        osname = 'alpine';
      }

      break;
    }
  }

  switch (arch) {
    case 'x64':
    case 'amd64':
      archname = 'amd64';
      break;
  }

  const binaryDeployments = readFileSync('binary-deployments.json', 'utf8');
  const supportedPlatforms = JSON.parse(binaryDeployments);
  const binaryName = supportedPlatforms[osname][archname];

  if (binaryName === undefined) {
    const defaultErrorMsg =
      ' The current platform (' +
      osname +
      ' ' +
      archname +
      ') is not supported by Snyk.\n' +
      ' You may want to consider using Docker to run Snyk, for details see: https://docs.snyk.io/snyk-cli/install-the-snyk-cli#snyk-cli-in-a-docker-image\n' +
      ' If you experience errors please reach out to support@snyk.io.';
    throw Error(getWarningMessage(defaultErrorMsg));
  }

  return binaryName;
}

export function getCurrentVersion(filename: string): string {
  try {
    const version = fs.readFileSync(filename);
    return version.toString().trim();
  } catch {
    return '';
  }
}

export function getCurrentSha256sum(
  binaryName: string,
  filename: string,
): string {
  try {
    const allsums = fs.readFileSync(filename).toString();
    const re = new RegExp('^([a-zA-Z0-9]+)[\\s\\*]+' + binaryName + '$', 'mig');
    const result = re.exec(allsums);
    if (result) {
      return result[1];
    }
  } catch {
    //
  }

  return 'unknown-shasum-' + binaryName;
}

export function getCurrentConfiguration(): WrapperConfiguration {
  const binaryName = determineBinaryName(os.platform(), os.arch());
  const version = getCurrentVersion(versionFile);
  const expectedSha256sum = getCurrentSha256sum(binaryName, shasumFile);
  return new WrapperConfiguration(version, binaryName, expectedSha256sum);
}

export function getCliArguments(inputArgv: string[]): string[] {
  const cliArguments = inputArgv.slice(2);
  return cliArguments;
}

export function debugEnabled(cliArguments: string[]): boolean {
  let debugIndex = cliArguments.indexOf('--debug');

  if (debugIndex < 0) {
    debugIndex = cliArguments.indexOf('-d');
  }

  return debugIndex >= 0;
}

export function runWrapper(executable: string, cliArguments: string[]): number {
  interface SpawnError extends Error {
    errno: number;
    code: string;
    syscall: string;
    path: string;
    spawnargs: string[];
  }

  const debug = debugEnabled(cliArguments);

  if (debug) {
    console.debug('Executing: ' + executable + ' ' + cliArguments.join(' '));
  }

  const res = spawnSync(executable, cliArguments, {
    shell: false,
    stdio: 'inherit',
  });

  if (res.status !== null) {
    if (debug) {
      console.debug(res);
    }

    return res.status;
  } else {
    console.error(res);
    if (!formatErrorMessage((res.error as SpawnError).code)) {
      console.error('Failed to spawn child process. (' + executable + ')');
    }

    return 2;
  }
}

function getWarningMessage(message: string): string {
  return `\n------------------------------- Warning -------------------------------\n${message}\n------------------------------- Warning -------------------------------\n`;
}

function formatErrorMessage(message: string): boolean {
  const eaccesWarning =
    "We don't have the permissions to install Snyk. Please try the following options:\n" +
    '* If installing with increased privileges (eg sudo), try adding unsafe-perm a parameter to npm install\n' +
    '* If you run NPM <= 6, please upgrade to a later version.\n' +
    'If the problems persist please contact support@snyk.io and include the information provided.';

  const certificateError =
    'If you are running Snyk in an environment that intercepts SSL traffic, please specify\n' +
    'your custom CA certificates via the NODE_EXTRA_CA_CERTS environment variable.\n' +
    'See https://nodejs.org/api/cli.html#node_extra_ca_certsfile for additional information.';

  if (message.includes('EACCES')) {
    console.error(getWarningMessage(eaccesWarning));
    return true;
  } else if (message.includes('certificate')) {
    console.error(getWarningMessage(certificateError));
    return true;
  }
  return false;
}

export function downloadExecutable(
  downloadUrl: string,
  filename: string,
  filenameShasum: string,
): Promise<Error | undefined> {
  return new Promise<Error | undefined>(function(resolve) {
    const options = new URL(downloadUrl);
    const temp = path.join(__dirname, Date.now().toString());
    const fileStream = fs.createWriteStream(temp);
    fileStream.on('error', (e) => {
      cleanupAfterError(e);
    });

    const cleanupAfterError = (error: Error) => {
      try {
        fs.unlinkSync(temp);
      } catch (e) {
        console.debug('Failed to cleanup temporary file (' + temp + '): ' + e);
      }

      resolve(error);
    };

    console.debug(
      "Downloading from '" + downloadUrl + "' to '" + filename + "'",
    );

    const req = https.request(options, (res) => {
      const shasum = createHash('sha256');

      shasum.on('error', cleanupAfterError);
      res.on('error', cleanupAfterError);
      res.on('end', () => {
        // compare shasums
        const actualShasum = shasum.digest('hex');

        const debugMessage =
          'Shasums:\n- actual:   ' +
          actualShasum +
          '\n- expected: ' +
          filenameShasum;

        if (filenameShasum && actualShasum != filenameShasum) {
          fileStream.close();
          shasum.end();
          cleanupAfterError(
            Error('Shasum comparison failed!\n' + debugMessage),
          );
        } else {
          console.debug(debugMessage);

          // finally rename the file and change permissions
          fs.renameSync(temp, filename);
          fs.chmodSync(filename, 0o755);
          console.debug('Downloaded successfull! ');

          shasum.end();
          fileStream.close();
          resolve(undefined);
        }
      });

      res.pipe(fileStream);
      res.pipe(shasum);
    });

    req.on('error', (e) => {
      cleanupAfterError(e);
    });

    req.on('response', (incoming) => {
      if (
        incoming.statusCode &&
        !(200 <= incoming.statusCode && incoming.statusCode < 300)
      ) {
        req.destroy();
        cleanupAfterError(
          Error(
            'Download failed! Server Response: ' +
              incoming.statusCode +
              ' ' +
              incoming.statusMessage,
          ),
        );
      }
    });

    req.end();
  });
}

export async function logError(context: string, err): Promise<void> {
  if (isAnalyticsEnabled()) {
    // init error reporting
    const version = getCurrentVersion(versionFile);
    Sentry.init({
      dsn:
        'https://3e845233db8c4f43b4c4b9245f1d7bd6@o30291.ingest.sentry.io/4504599528079360',
      release: version,
    });

    // report error
    const sentryError = new Error('[' + context + '] ' + err.message);
    sentryError.stack = err.stack;
    Sentry.captureException(sentryError);
    await Sentry.close();
  }

  // finally log the error to the console as well
  console.error(err);
  formatErrorMessage(err.message);
}

export function isAnalyticsEnabled(): boolean {
  if (
    process.env.snyk_disable_analytics == '1' ||
    process.env.SNYK_DISABLE_ANALYTICS == '1'
  ) {
    return false;
  }

  return true;
}
