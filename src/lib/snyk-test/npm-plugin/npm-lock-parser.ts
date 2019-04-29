import * as baseDebug from 'debug';
const debug = baseDebug('snyk');
import * as path from 'path';
import * as snyk from '../..';
import * as spinner from '../../spinner';
import * as _ from 'lodash';
import * as analytics from '../../analytics';
import * as fs from 'fs';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';

export async function parse(root, targetFile, options) {
  const lockFileFullPath = path.resolve(root, targetFile);
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error('Lockfile ' + targetFile + ' not found at location: ' +
      lockFileFullPath);
  }

  const fullPath = path.parse(lockFileFullPath);
  const manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');
  const shrinkwrapFullPath = path.resolve(fullPath.dir, 'npm-shrinkwrap.json');

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new Error('Manifest file package.json not found at location: ' +
      manifestFileFullPath);
  }

  if (!manifestFileFullPath && lockFileFullPath) {
    throw new Error('Detected a lockfile at location: '
      + lockFileFullPath + '\n However the package.json is missing!');
  }

  if (fs.existsSync(shrinkwrapFullPath)) {
    throw new Error('`npm-shrinkwrap.json` was found while using lockfile.\n'
      + 'Please run your command again without `--file=' + targetFile + '` flag.');
  }

  const manifestFile = fs.readFileSync(manifestFileFullPath);
  const lockFile = fs.readFileSync(lockFileFullPath, 'utf-8');

  analytics.add('local', true);
  analytics.add('generating-node-dependency-tree', {
    lockFile: true,
    targetFile,
  });

  const lockFileType = targetFile.endsWith('yarn.lock') ?
    lockFileParser.LockfileType.yarn : lockFileParser.LockfileType.npm;

  const resolveModuleSpinnerLabel = `Analyzing npm dependencies for ${lockFileFullPath}`;
  debug(resolveModuleSpinnerLabel);
  try {
    await spinner(resolveModuleSpinnerLabel);
    const strictOutOfSync = _.get(options, 'strictOutOfSync') !== 'false';
    return lockFileParser
      .buildDepTree(manifestFile.toString(), lockFile, options.dev, lockFileType, strictOutOfSync);
  } finally {
    await spinner.clear(resolveModuleSpinnerLabel);
  }
}
