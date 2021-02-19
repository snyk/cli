import * as fs from 'fs';
import protect from '../../src/lib';
import * as path from 'path';

describe('new snyk protect', () => {
  it('works', async () => {
    const fixtureFolder = path.join(
      __dirname,
      '../fixtures/single-patchable-module',
    );
    const origTargetFilePath = path.join(
      fixtureFolder,
      'node_modules/nyc/node_modules/lodash/lodash.js.4.17.15.bak',
    );
    const targeFilePath = path.join(
      fixtureFolder,
      'node_modules/nyc/node_modules/lodash/lodash.js',
    );
    const expectedPatchedFilePath = path.join(
      fixtureFolder,
      'lodash-expected-patched.js',
    );

    try {
      // make sure the target file is the orig one
      const origTargetFileContents = fs.readFileSync(origTargetFilePath);
      fs.writeFileSync(targeFilePath, origTargetFileContents);
      await protect(fixtureFolder);
      const actualPatchedFileContents = fs.readFileSync(targeFilePath);
      const expectedPatchedFileContents = fs.readFileSync(
        expectedPatchedFilePath,
      );
      expect(actualPatchedFileContents).toEqual(expectedPatchedFileContents);
    } finally {
      // reset the target file
      const origTargetFileContents = fs.readFileSync(origTargetFilePath);
      fs.writeFileSync(targeFilePath, origTargetFileContents);
    }
  });
});
