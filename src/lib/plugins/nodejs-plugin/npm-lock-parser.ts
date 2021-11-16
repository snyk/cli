import * as baseDebug from 'debug';
const debug = baseDebug('snyk-test');
import * as path from 'path';
import { spinner } from '../../spinner';
import * as analytics from '../../analytics';
import * as fs from 'fs';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import { PkgTree } from 'snyk-nodejs-lockfile-parser';
import { Options } from '../types';

export async function parse(
  root: string,
  targetFile: string,
  options: Options,
): Promise<PkgTree> {
  const lockFileFullPath = path.resolve(root, targetFile);
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error(
      'Lockfile ' + targetFile + ' not found at location: ' + lockFileFullPath,
    );
  }

  const fullPath = path.parse(lockFileFullPath);
  const manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');
  const shrinkwrapFullPath = path.resolve(fullPath.dir, 'npm-shrinkwrap.json');

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new Error(
      `Could not find package.json at ${manifestFileFullPath} ` +
        `(lockfile found at ${targetFile})`,
    );
  }

  if (fs.existsSync(shrinkwrapFullPath)) {
    throw new Error(
      'Both `npm-shrinkwrap.json` and `package-lock.json` were found in ' +
        fullPath.dir +
        '.\n' +
        'Please run your command again specifying `--file=package.json` flag.',
    );
  }

  analytics.add('local', true);
  analytics.add('generating-node-dependency-tree', {
    lockFile: true,
    targetFile,
  });
  const resolveModuleSpinnerLabel = `Analyzing npm dependencies for ${lockFileFullPath}`;
  debug(resolveModuleSpinnerLabel);
  try {
    await spinner(resolveModuleSpinnerLabel);
    const strictOutOfSync = options.strictOutOfSync !== false;
    return lockFileParser.buildDepTreeFromFiles(
      root,
      manifestFileFullPath,
      lockFileFullPath,
      options.dev,
      strictOutOfSync,
    );
  } finally {
    await spinner.clear<void>(resolveModuleSpinnerLabel)();
  }
}
