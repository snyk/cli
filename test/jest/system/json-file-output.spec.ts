import * as jsonFileOutputModule from '../../../src/lib/json-file-output';

import { v4 as uuidv4 } from 'uuid';
import { readFileSync, unlinkSync, rmdirSync, mkdirSync, existsSync } from 'fs';
import * as path from 'path';
import * as fsModule from 'fs';

describe('saveJsonToFileCreatingDirectoryIfRequired', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('supports absolute paths', () => {
    it('with directory that does not exists', async () => {
      const tempFolder = uuidv4();
      const outputPath = path.join(
        process.cwd(),
        'test-output',
        tempFolder,
        'test-output.json',
      );

      const fullDirPath = path.dirname(outputPath);
      expect(fullDirPath).toBe(
        path.join(process.cwd(), 'test-output', tempFolder),
      );
      const jsonString = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      const mkdirSyncDirSpy = jest.spyOn(fsModule, 'mkdirSync');

      try {
        // this should create the tempFolder inside of test-output (and test-ouptut if it doesn't exist yet) as well as write the file
        await jsonFileOutputModule.saveJsonToFileCreatingDirectoryIfRequired(
          outputPath,
          jsonString,
        );

        // ensure that mkDirSync was called once
        expect(mkdirSyncDirSpy).toHaveBeenCalledTimes(1);

        const outputFileContents = readFileSync(outputPath, 'utf-8');
        expect(outputFileContents.trim()).toEqual(jsonString);
      } finally {
        unlinkSync(outputPath);
        rmdirSync(fullDirPath);
      }
    });

    it('with directory that already exists', async () => {
      const tempFolder = uuidv4();
      const outputPath = path.join(
        process.cwd(),
        'test-output',
        tempFolder,
        'test-output.json',
      );

      // if 'test-output' doesn't exist, created it
      if (!existsSync('test-output')) {
        mkdirSync('test-output');
      }

      const fullDirPath = path.dirname(outputPath);

      // create the temp folder before calling saveJsonToFileCreatingDirectoryIfRequired
      mkdirSync(fullDirPath);
      expect(fullDirPath).toBe(
        path.join(process.cwd(), 'test-output', tempFolder),
      );
      const jsonString = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      const mkdirSyncDirSpy = jest.spyOn(fsModule, 'mkdirSync');
      expect(mkdirSyncDirSpy).toHaveBeenCalledTimes(0); // zero because we already created the temp folder, so should have to create it again

      try {
        // this should create the tempFolder inside of test-output (and test-ouptut if it doesn't exist yet) as well as write the file
        await jsonFileOutputModule.saveJsonToFileCreatingDirectoryIfRequired(
          outputPath,
          jsonString,
        );

        // ensure that mkDirSync was called once
        expect(mkdirSyncDirSpy).toHaveBeenCalledTimes(0); // zero because we already created the temp folder, so should have to create it again

        const outputFileContents = readFileSync(outputPath, 'utf-8');
        expect(outputFileContents.trim()).toEqual(jsonString);
      } finally {
        unlinkSync(outputPath);
        rmdirSync(fullDirPath);
      }
    });
  });

  // relative paths
  describe('supports relative paths', () => {
    it('with directory that does not exists', async () => {
      const tempFolder = uuidv4();
      const outputPath = path.join(
        'test-output',
        tempFolder,
        'test-output.json',
      );

      const fullDirPath = path.dirname(outputPath);
      expect(fullDirPath).toBe(path.join('test-output', tempFolder));
      const jsonString = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      const mkdirSyncDirSpy = jest.spyOn(fsModule, 'mkdirSync');

      try {
        // this should create the tempFolder inside of test-output (and test-ouptut if it doesn't exist yet) as well as write the file
        await jsonFileOutputModule.saveJsonToFileCreatingDirectoryIfRequired(
          outputPath,
          jsonString,
        );

        // ensure that mkDirSync was called once
        expect(mkdirSyncDirSpy).toHaveBeenCalledTimes(1);

        const outputFileContents = readFileSync(outputPath, 'utf-8');
        expect(outputFileContents.trim()).toEqual(jsonString);
      } finally {
        unlinkSync(outputPath);
        rmdirSync(fullDirPath);
      }
    });

    it('with directory that already exists', async () => {
      const tempFolder = uuidv4();
      const outputPath = path.join(
        'test-output',
        tempFolder,
        'test-output.json',
      );

      // if 'test-output' doesn't exist, created it
      if (!existsSync('test-output')) {
        mkdirSync('test-output');
      }

      const fullDirPath = path.dirname(outputPath);

      // create the temp folder before calling saveJsonToFileCreatingDirectoryIfRequired
      mkdirSync(fullDirPath);
      expect(fullDirPath).toBe(path.join('test-output', tempFolder));
      const jsonString = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      const mkdirSyncDirSpy = jest.spyOn(fsModule, 'mkdirSync');
      expect(mkdirSyncDirSpy).toHaveBeenCalledTimes(0); // zero because we already created the temp folder, so should have to create it again

      try {
        // this should create the tempFolder inside of test-output (and test-ouptut if it doesn't exist yet) as well as write the file
        await jsonFileOutputModule.saveJsonToFileCreatingDirectoryIfRequired(
          outputPath,
          jsonString,
        );

        // ensure that mkDirSync was called once
        expect(mkdirSyncDirSpy).toHaveBeenCalledTimes(0); // zero because we already created the temp folder, so should have to create it again

        const outputFileContents = readFileSync(outputPath, 'utf-8');
        expect(outputFileContents.trim()).toEqual(jsonString);
      } finally {
        unlinkSync(outputPath);
        rmdirSync(fullDirPath);
      }
    });
  });
});
