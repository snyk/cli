import * as fs from 'fs';
import * as path from 'path';
import {
  extractTargetFilePathFromPatch,
  patchString,
} from '../../src/lib/patch';

describe(patchString.name, () => {
  it('can apply a patch using string', () => {
    const fixtureFolder = path.join(
      __dirname,
      '../fixtures/patchable-file-lodash',
    );
    const patchFilePath = path.join(fixtureFolder, 'lodash.patch');

    const patchContents = fs.readFileSync(patchFilePath, 'utf-8');

    const targetFilePath = path.join(
      fixtureFolder,
      extractTargetFilePathFromPatch(patchContents),
    );
    const contentsToPatch = fs.readFileSync(targetFilePath, 'utf-8');

    const patchedContents = patchString(patchContents, contentsToPatch);

    const expectedPatchedContentsFilePath = path.join(
      fixtureFolder,
      'lodash-expected-patched.js',
    );
    const expectedPatchedContents = fs.readFileSync(
      expectedPatchedContentsFilePath,
      'utf-8',
    );
    expect(patchedContents).toBe(expectedPatchedContents);
  });

  it('keeps the same line endings', () => {
    const fixtureFolder = path.join(
      __dirname,
      '../fixtures/patchable-file-lodash',
    );
    const patchFilePath = path.join(fixtureFolder, 'lodash.patch');

    const patchContents = fs.readFileSync(patchFilePath, 'utf-8');

    const targetFilePath = path.join(
      fixtureFolder,
      extractTargetFilePathFromPatch(patchContents),
    );
    const contentsToPatch = fs
      .readFileSync(targetFilePath, 'utf-8')
      .split('\n')
      .join('\r\n');

    const patchedContents = patchString(patchContents, contentsToPatch);

    const expectedPatchedContentsFilePath = path.join(
      fixtureFolder,
      'lodash-expected-patched.js',
    );

    const expectedPatchedContents = fs
      .readFileSync(expectedPatchedContentsFilePath, 'utf-8')
      .split('\n')
      .join('\r\n');
    expect(patchedContents).toBe(expectedPatchedContents);
  });

  // if the patch is not compatible with the target, make sure we throw an Error and do patch
  it('will throw if patch does not match target', () => {
    const fixtureFolder = path.join(
      __dirname,
      '../fixtures/non-patchable-file-because-non-matching',
    );
    const patchFilePath = path.join(fixtureFolder, 'lodash.patch');
    const patchContents = fs.readFileSync(patchFilePath, 'utf-8');
    const targetFilePath = path.join(
      fixtureFolder,
      extractTargetFilePathFromPatch(patchContents),
    );
    const contentsToPatch = fs.readFileSync(targetFilePath, 'utf-8');
    expect(() => {
      patchString(patchContents, contentsToPatch);
    }).toThrow(Error);
  });
});
