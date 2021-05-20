import * as fse from 'fs-extra';
import * as path from 'path';

const getPatchedLodash = (): Promise<string> => {
  const patchedLodashPath = path.resolve(
    __dirname,
    '../fixtures/patchable-file-lodash/lodash-expected-patched.js',
  );

  return fse.readFile(patchedLodashPath, 'utf-8');
};

export { getPatchedLodash };
