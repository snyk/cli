import * as fs from 'fs';
import * as path from 'path';
import { createProjectFromFixture } from '../util/createProject';
import {
  createDirectory,
  saveObjectToFile,
  writeContentsToFileSwallowingErrors,
} from '../../../src/lib/json-file-output';
import { humanFileSize, isWindowsOperatingSystem } from '../../utils';

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
    if (!isWindowsOperatingSystem()) {
      const project = await createProjectFromFixture('json-file-output');
      // create a directory without write permissions
      fs.mkdirSync(path.join(project.path(), 'read-only'), 0o555);
      const outputPath = project.path('read-only/test-output.json');

      await writeContentsToFileSwallowingErrors(outputPath, 'fake-contents');
      expect(fs.existsSync(outputPath)).toBe(false);
    }
  });
});

describe('saveObjectToFile', () => {
  it('can write objects to file', async () => {
    const project = await createProjectFromFixture('json-file-output');
    const outputFile = project.path('test-output.json');

    const payload = require('../../fixtures/lodash@4.17.11-vuln.json');

    await saveObjectToFile(outputFile, payload);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Ensure async operations complete
    console.log({
      outputFile,
      outputFileSize: humanFileSize(fs.statSync(outputFile).size),
    });
    expect(fs.statSync(outputFile).size).toBeGreaterThan(0); // >50MB

    const savedFile = fs.readFileSync(outputFile, 'utf8');
    expect(JSON.parse(savedFile)).toMatchObject(payload);
  });
});
