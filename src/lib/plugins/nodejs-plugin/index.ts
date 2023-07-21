import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from '../types';
import * as analytics from '../../analytics';
import { MissingTargetFileError } from '../../errors/missing-targetfile-error';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { DepGraph } from '@snyk/dep-graph';
import {
  PkgTree,
  getLockfileVersionFromFile,
  NodeLockfileVersion,
} from 'snyk-nodejs-lockfile-parser';

import * as path from 'path';

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
  const depRes: PkgTree | DepGraph = getLockFileDeps
    ? await lockParser.parse(root, targetFile, options)
    : await modulesParser.parse(root, targetFile, options);

  let scannedProjects: any[] = [];
  if (isResDepGraph(depRes)) {
    scannedProjects = [{ depGraph: depRes }];
  } else {
    scannedProjects = [{ depTree: depRes }];
  }

  if (isLockFileBased) {
    const lockFileFullPath = path.resolve(root, targetFile);
    const lockfileVersion = getLockfileVersionFromFile(lockFileFullPath);
    switch (lockfileVersion) {
      case NodeLockfileVersion.NpmLockV1:
      case NodeLockfileVersion.YarnLockV1:
        analytics.add('lockfileVersion', 1);
        break;
      case NodeLockfileVersion.NpmLockV2:
      case NodeLockfileVersion.YarnLockV2:
        analytics.add('lockfileVersion', 2);
        break;
      case NodeLockfileVersion.NpmLockV3:
        analytics.add('lockfileVersion', 3);
        break;
      default:
        break;
    }
  }

  return {
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: process.version,
    },
    scannedProjects,
  };
}

function isResDepGraph(depRes: PkgTree | DepGraph): depRes is DepGraph {
  return 'rootPkg' in depRes;
}
