import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import * as https from 'https';
import { createHash } from 'crypto';
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

export function determineBinaryName(
  platform: NodeJS.Platform,
  arch: string,
): string {
  const basename = 'snyk-';
  let osname: string;
  let archname = '';
  let suffix = '';

  switch (platform) {
    case 'win32':
      osname = 'win';
      suffix = '.exe';
      break;
    case 'darwin':
      osname = 'macos';
      break;
    default: {
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
      } else {
        osname = 'linux';
      }

      break;
    }
  }

  switch (arch) {
    case 'x64':
    case 'amd64':
      archname = '';
      break;
    case 'arm64':
      archname = '-arm64';
      break;
    default:
      throw Error('------------------------------- Warning -------------------------------\n' +
        ' The current platform (' +
        platform +
        ' ' +
        arch +
        ') is not supported by Snyk.\n' +
        ' You may want to consider using Docker to run Snyk, for details see: https://docs.snyk.io/snyk-cli/install-the-snyk-cli#snyk-cli-in-a-docker-image\n' +
        ' If you experience errors please reach out to support@snyk.io.\n' +
        '-----------------------------------------------------------------------');
  }

  if (platform == 'linux') {
    return basename + osname + archname + suffix;
  } else {
    return basename + osname + suffix;
  }
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

    interface SpawnError {
      errno: number;
      code: string;
      syscall: string;
      path: string;
      spawnargs: string[];
    }

    const spawnError = (res.error as unknown) as SpawnError;
    if (spawnError?.code == 'EACCES') {
      console.error(
        "We don't have the permissions to install snyk. Please try the following options:\n" +
          '* If installing with increased privileges (eg sudo), try adding --unsafe-perm as a parameter to npm install\n' +
          '* If you run NPM <= 6, please upgrade to a later version.\n' +
          'If the problems persist please contact support@snyk.io and include the information provided above.',
      );
    } else {
      console.error('Failed to spawn child process. (' + executable + ')');
    }

    return 2;
  }
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
      res.pipe(fileStream);
      res.pipe(shasum);

      fileStream.on('finish', () => {
        fileStream.close();

        // compare shasums
        const actualShasum = shasum.digest('hex');

        const debugMessage =
          'Shasums:\n- actual:   ' +
          actualShasum +
          '\n- expected: ' +
          filenameShasum;

        if (filenameShasum && actualShasum != filenameShasum) {
          cleanupAfterError(
            Error('Shasum comparison failed!\n' + debugMessage),
          );
        } else {
          console.debug(debugMessage);

          // finally rename the file and change permissions
          fs.renameSync(temp, filename);
          fs.chmodSync(filename, 0o755);
          console.debug('Downloaded successfull! ');
          resolve(undefined);
        }
      });
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
