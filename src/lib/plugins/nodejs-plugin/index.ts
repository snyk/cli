import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from '../types';
import * as analytics from '../../analytics';
import { MissingTargetFileError } from '../../errors/missing-targetfile-error';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  if (!targetFile) {
    throw MissingTargetFileError(root);
  }
  const isLockFileBased =
    targetFile.endsWith('package-lock.json') ||
    targetFile.endsWith('yarn.lock');

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  const depTree: any = getLockFileDeps
    ? await lockParser.parse(root, targetFile, options)
    : await modulesParser.parse(root, targetFile, options);

  if (depTree?.meta?.lockfileVersion) {
    analytics.add('lockfileVersion', depTree.meta.lockfileVersion);
  }

  return {
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: process.version,
    },
    scannedProjects: [{ depTree }],
  };
}
