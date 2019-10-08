import * as baseDebug from 'debug';
const debug = baseDebug('snyk');
import * as path from 'path';
import { Spinner } from 'cli-spinner';
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
      '`npm-shrinkwrap.json` was found while using lockfile.\n' +
        'Please run your command again without `--file=' +
        targetFile +
        '` flag.',
    );
  }

  const manifestFile = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFile = fs.readFileSync(lockFileFullPath, 'utf-8');

  analytics.add('local', true);
  analytics.add('generating-node-dependency-tree', {
    lockFile: true,
    targetFile,
  });

  const lockFileType = targetFile.endsWith('yarn.lock')
    ? lockFileParser.LockfileType.yarn
    : lockFileParser.LockfileType.npm;

  const resolveModuleSpinnerLabel = `Analyzing npm dependencies for ${lockFileFullPath}`;
  const spinner = new Spinner(resolveModuleSpinnerLabel);
  spinner.setSpinnerString('|/-\\');

  debug(resolveModuleSpinnerLabel);
  try {
    spinner.start();
    const strictOutOfSync = options.strictOutOfSync !== false;
    return lockFileParser.buildDepTree(
      manifestFile,
      lockFile,
      options.dev,
      lockFileType,
      strictOutOfSync,
    );
  } finally {
    spinner.stop(true);
  }
}
