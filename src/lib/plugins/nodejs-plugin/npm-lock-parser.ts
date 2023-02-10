import * as baseDebug from 'debug';
const debug = baseDebug('snyk-test');
import * as path from 'path';
import { spinner } from '../../spinner';
import * as analytics from '../../analytics';
import * as fs from 'fs';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import {
  NodeLockfileVersion,
  PkgTree,
  InvalidUserInputError,
  ProjectParseOptions,
} from 'snyk-nodejs-lockfile-parser';
import { Options } from '../types';
import { DepGraph } from '@snyk/dep-graph';

export async function parse(
  root: string,
  targetFile: string,
  options: Options,
): Promise<PkgTree | DepGraph> {
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

  const strictOutOfSync = options.strictOutOfSync !== false;
  const lockfileVersion = lockFileParser.getLockfileVersionFromFile(
    lockFileFullPath,
  );
  if (
    lockfileVersion === NodeLockfileVersion.YarnLockV1 ||
    lockfileVersion === NodeLockfileVersion.YarnLockV2 ||
    lockfileVersion === NodeLockfileVersion.NpmLockV2 ||
    lockfileVersion === NodeLockfileVersion.NpmLockV3
  ) {
    return await buildDepGraph(
      root,
      manifestFileFullPath,
      lockFileFullPath,
      lockfileVersion,
      {
        includeDevDeps: options.dev || false,
        includeOptionalDeps: true,
        strictOutOfSync,
        pruneCycles: true,
      },
    );
  }

  try {
    await spinner(resolveModuleSpinnerLabel);
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

async function buildDepGraph(
  root: string,
  manifestFilePath: string,
  lockfilePath: string,
  lockfileVersion: NodeLockfileVersion,
  options: ProjectParseOptions,
): Promise<DepGraph> {
  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  const lockFileFullPath = path.resolve(root, lockfilePath);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new InvalidUserInputError(
      'Target file package.json not found at ' +
        `location: ${manifestFileFullPath}`,
    );
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new InvalidUserInputError(
      'Lockfile not found at location: ' + lockFileFullPath,
    );
  }

  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');

  switch (lockfileVersion) {
    case NodeLockfileVersion.YarnLockV1:
      return await lockFileParser.parseYarnLockV1Project(
        manifestFileContents,
        lockFileContents,
        options,
      );
    case NodeLockfileVersion.YarnLockV2:
      return lockFileParser.parseYarnLockV2Project(
        manifestFileContents,
        lockFileContents,
        options,
      );
    case NodeLockfileVersion.NpmLockV2:
    case NodeLockfileVersion.NpmLockV3:
      return lockFileParser.parseNpmLockV2Project(
        manifestFileContents,
        lockFileContents,
        options,
      );
  }
  throw new Error('Failed to build dep graph from current project');
}
