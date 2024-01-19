import * as fs from 'fs';
import * as path from 'path';
import { createProjectFromFixture } from '../util/createProject';
import {
  createDirectory,
  saveObjectToFileCreatingDirectoryIfRequired,
  writeContentsToFileSwallowingErrors,
} from '../../../src/lib/json-file-output';
import * as os from 'os';

const isWindows = os.platform().indexOf('win') === 0;

describe('createDirectory', () => {
  it('returns true if directory already exists - non-recursive', async () => {
    const project = await createProjectFromFixture('json-file-output');
    // attempt to create the directory
    expect(createDirectory(project.path())).toBe(true);

    expect(fs.existsSync(project.path())).toBe(true);
  });

  it('creates directory - recursive', async () => {
    const project = await createProjectFromFixture('json-file-output');
    const pathToLevelOne = project.path('level-one');
    // attempt to create the directory requiring recursive
    expect(createDirectory(pathToLevelOne)).toBe(true);
    expect(fs.existsSync(pathToLevelOne)).toBe(true);
  });
});

describe('writeContentsToFileSwallowingErrors', () => {
  it('can write a file', async () => {
    const project = await createProjectFromFixture('json-file-output');
    const pathToFile = project.path('test-output.json');
    // this should throw an error within writeContentsToFileSwallowingErrors but that error should be caught, logged, and disregarded
    await writeContentsToFileSwallowingErrors(pathToFile, 'fake-contents');
    expect(fs.existsSync(pathToFile)).toBe(true);
  });

  it('captures any errors when attempting to write to a readonly directory', async () => {
    if (!isWindows) {
      const project = await createProjectFromFixture('json-file-output');
      // create a directory without write permissions
      fs.mkdirSync(path.join(project.path(), 'read-only'), 0o555);
      const outputPath = project.path('read-only/test-output.json');

      await writeContentsToFileSwallowingErrors(outputPath, 'fake-contents');
      expect(fs.existsSync(outputPath)).toBe(false);
    }
  });
});

describe('saveObjectToFileCreatingDirectoryIfRequired', () => {
  jest.setTimeout(1000 * 20);
  it('can write large objects to file', async () => {
    const project = await createProjectFromFixture('json-file-output');
    const outputFile = project.path('test-output.json');

    const bigObject = {
      bigArray: new Array(32 * 1024 * 1024).fill({}),
      biggerArray: new Array(32 * 1024 * 1024).fill({}),
    };

    await saveObjectToFileCreatingDirectoryIfRequired(outputFile, bigObject);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Ensure async operations complete
    console.log({
      outputFile,
      outputFileSize: humanFileSize(fs.statSync(outputFile).size),
    });
    expect(fs.statSync(outputFile).size).toBeGreaterThan(0); // >50MB
  });
});

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
function humanFileSize(bytes, si = false, dp = 1) {
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
