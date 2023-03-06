import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import * as https from 'https';
import { randomInt, createHash } from 'crypto';

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
      archname = '';
      break;
    case 'arm64':
      archname = '-arm64';
      break;
    default:
      throw '------------------------------- Warning -------------------------------\n' +
        ' The current platform (' +
        platform +
        ' ' +
        arch +
        ') is not supported by Snyk.\n' +
        ' You may want to consider using Docker to run Snyk, for details see: https://docs.snyk.io/snyk-cli/install-the-snyk-cli#snyk-cli-in-a-docker-image\n' +
        ' If you experience errors please reach out to support@snyk.io.\n' +
        '-----------------------------------------------------------------------';
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

  if (debug) {
    console.debug(res);
  }

  let exitCode = 2;
  if (res.status !== null) {
    exitCode = res.status;
  } else {
    console.error(
      'Failed to spawn child process, ensure to run bootstrap first. (' +
        executable +
        ')',
    );
  }

  return exitCode;
}

export async function downloadExecutable(
  downloadUrl: string,
  filename: string,
  filenameShasum: string,
): Promise<number> {
  return new Promise<number>(function(resolve) {
    const options = new URL(downloadUrl);
    const temp = path.join(__dirname, randomInt(100000).toString());
    const fileStream = fs.createWriteStream(temp);

    const cleanupAfterError = (exitCode: number) => {
      try {
        fs.unlinkSync(temp);
      } catch (e) {
        console.debug('Failed to cleanup temporary file (' + temp + '): ' + e);
      }
      resolve(exitCode);
    };

    console.error(
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
        console.debug(
          'Shasums:\n- actual:   ' +
            actualShasum +
            '\n- expected: ' +
            filenameShasum,
        );
        if (filenameShasum && actualShasum != filenameShasum) {
          console.error('Failed Shasum comparison!');
          cleanupAfterError(3);
        } else {
          // finally rename the file and change permissions
          fs.renameSync(temp, filename);
          fs.chmodSync(filename, 0o750);
          console.debug('Downloaded successfull! ');
          resolve(0);
        }
      });
    });

    req.on('error', (e) => {
      console.debug('Error during download!');
      console.error(e);
      cleanupAfterError(1);
    });

    req.on('response', (incoming) => {
      if (
        incoming.statusCode &&
        !(200 <= incoming.statusCode && incoming.statusCode < 300)
      ) {
        req.destroy();
        console.debug('Failed to download! ' + incoming.statusMessage);
        cleanupAfterError(2);
      }
    });

    req.end();
  });
}
