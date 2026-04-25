import { tmpdir, platform } from 'os';
import { join } from 'path';
import { mkdir, readFileSync } from 'fs';

export function silenceLog() {
  const old = console.log;
  console.log = () => {
    return;
  };
  return () => {
    console.log = old;
  };
}

export async function makeDirectory(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    mkdir(path, (err) => {
      if (err) {
        reject(err);
      }
      resolve(path);
    });
  });
}

export async function makeTmpDirectory(): Promise<string> {
  const dirname = join(
    tmpdir(),
    'TMP' +
      Math.random()
        .toString(36)
        .replace(/[^a-z0-9]+/g, '')
        .substr(2, 12),
  );
  return makeDirectory(dirname);
}

export function loadJson(filename: string) {
  return JSON.parse(readFileSync(filename, 'utf-8'));
}

/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
export function humanFileSize(bytes, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + ' ' + units[u];
}

/**
 * Check if the current platform is Windows
 *
 * @returns boolean
 */
export function isWindowsOperatingSystem(): boolean {
  return platform().indexOf('win') === 0;
}

/**
 * Conditionally run a test if the condition is true
 *
 * @param condition boolean
 * @returns jest.It
 */
export function testIf(condition: boolean): jest.It {
  return condition ? test : test.skip;
}

/**
 * Conditionally run a describe block if the condition is true
 *
 * @param condition boolean
 * @returns jest.Describe
 */
export const describeIf = (condition: boolean): jest.Describe =>
  condition ? describe : describe.skip;
