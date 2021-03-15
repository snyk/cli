import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from '../types';
import { MissingTargetFileError } from '../../errors/missing-targetfile-error';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { ScannedProject } from '@snyk/cli-interface/legacy/common';
import * as depGraphLib from '@snyk/dep-graph';

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  if (!targetFile) {
    throw MissingTargetFileError(root);
  }
  const isNpmLockFile = targetFile.endsWith('package-lock.json');
  const isYarnLockFile = targetFile.endsWith('yarn.lock');
  const isLockFileBased = isNpmLockFile || isYarnLockFile;

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  const depTree: any = getLockFileDeps
    ? await lockParser.parse(root, targetFile, options)
    : await modulesParser.parse(root, targetFile, options);

  const scannedProject: ScannedProject = {};
  if (getLockFileDeps) {
    const pkgManagerName =
      options?.packageManager || (isYarnLockFile ? 'yarn' : 'npm');
    const depGraph = await depGraphLib.legacy.depTreeToGraph(
      depTree,
      pkgManagerName,
    );
    scannedProject.depGraph = depGraph;
  } else {
    scannedProject.depTree = depTree;
  }

  return {
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: process.version,
    },
    scannedProjects: [scannedProject],
  };
}
