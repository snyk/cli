import * as fs from 'fs';
import protect from '../../src/lib';
import * as path from 'path';
import * as uuid from 'uuid';
import * as fse from 'fs-extra';

describe('@snyk/protect', () => {
  let tempFolder: string;

  beforeAll(() => {
    tempFolder = path.join(__dirname, '__output__', uuid.v4());
    fs.mkdirSync(tempFolder, { recursive: true });
  });

  afterAll(() => {
    fs.rmdirSync(tempFolder, {
      recursive: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('applies patch(es)', () => {
    it('works for project with a single patchable module', async () => {
      const fixture = 'single-patchable-module';
      const fixtureFolder = path.join(__dirname, '../fixtures', fixture);
      const modulePath = path.join(tempFolder, fixture);
      const targeFilePath = path.join(
        modulePath,
        'node_modules/nyc/node_modules/lodash/lodash.js',
      );
  
      await fse.copy(fixtureFolder, modulePath);
      await protect(modulePath);
  
      const actualPatchedFileContents = fs.readFileSync(targeFilePath, 'utf-8');
      expect(actualPatchedFileContents).toMatchSnapshot();
    });
  
    it('works for project with multiple patchable modules', async () => {
      const fixture = 'multiple-matching-paths';
      const fixtureFolder = path.join(__dirname, '../fixtures', fixture);
      const modulePath = path.join(tempFolder, fixture);
      const targeFilePath1 = path.join(
        modulePath,
        'node_modules/nyc/node_modules/lodash/lodash.js',
      );
      const targeFilePath2 = path.join(
        modulePath,
        'node_modules/lodash/lodash.js',
      );
  
      await fse.copy(fixtureFolder, modulePath);
      await protect(modulePath);
  
      const actualPatchedFileContents = fs.readFileSync(targeFilePath1, 'utf-8');
      expect(actualPatchedFileContents).toMatchSnapshot();
      const actualPatchedFileContents2 = fs.readFileSync(targeFilePath2, 'utf-8');
      expect(actualPatchedFileContents2).toMatchSnapshot();
    });
  });

  describe('does not apply any patches and does not fail', () => {
    // in this scenario .snyk file has a vulnId which corresponds to the `lodash` package, but there are not instances of lodash in the node_modules
    it('for project with no modules with the target package name', async () => {
      const fixture = 'no-matching-paths';
      const fixtureFolder = path.join(__dirname, '../fixtures', fixture);
      const modulePath = path.join(tempFolder, fixture);

      const log = jest.spyOn(global.console, 'log');
      await fse.copy(fixtureFolder, modulePath);
      await protect(modulePath);

      expect(log).toHaveBeenCalledWith('Nothing to patch, done');
    });

    // skipped because we need to check the versions of the found modules before we attempt to patch them which we don't currently do
    // and in order to do that, we need to first switch over to the new endpoint
    // it('for a project that has an instance of the target module but we have no patches for its version', async () => {
    //   const fixture = 'target-module-exists-but-no-patches-for-version';
    //   const fixtureFolder = path.join(__dirname, '../fixtures', fixture);
    //   const modulePath = path.join(tempFolder, fixture);

    //   const log = jest.spyOn(global.console, 'log');
    //   await fse.copy(fixtureFolder, modulePath);
    //   await protect(modulePath);

    //   expect(log).toHaveBeenCalledWith('Nothing to patch, done');
    // });

    // fixture has a lodash@4.14.1 which we don't have patches for
    it('for project with no .snyk file', async () => {
      const fixture = 'no-snyk-file';
      const fixtureFolder = path.join(__dirname, '../fixtures', fixture);
      const modulePath = path.join(tempFolder, fixture);

      const log = jest.spyOn(global.console, 'log');
      await fse.copy(fixtureFolder, modulePath);
      await protect(modulePath);

      expect(log).toHaveBeenCalledWith('No .snyk file found');
    });
  });
});
