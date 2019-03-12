import * as path from 'path';
import * as fs from 'then-fs';
import * as _ from 'lodash';
import {buildDepTree, PkgTree, LockfileType} from 'snyk-nodejs-lockfile-parser';
import * as snyk from '../../';

interface Options {
  traverseNodeModules?: boolean;
  dev?: boolean;
  strictOutOfSync?: boolean | 'true' | 'false';
}

interface InspectResult {
  plugin: {
    name: string;
    runtime: string;
  };
  package: PkgTree;
}

export async function inspect(root: string, targetFile: string, options: Options = {}): Promise<InspectResult> {
  const isLockFileBased = targetFile.endsWith('package-lock.json');
  const targetFileFullPath = path.resolve(root, targetFile);
  const isShrinkwrapPresent = await fs.exists(path.join(path.dirname(targetFileFullPath), 'npm-shrinkwrap.json'));

  if (isLockFileBased && !isShrinkwrapPresent && !options.traverseNodeModules) {
    return {
      plugin: {
        name: 'snyk-nodejs-lockfile-parser',
        runtime: process.version,
      },
      package: await generateDependenciesFromLockfile(root, targetFile, options),
    };
  }

  // Old style npm projects.
  return {
    plugin: {
      name: 'snyk-resolve-deps',
      runtime: process.version,
    },
    package: await snyk.modules(root, Object.assign({}, options, {noFromArrays: true})),
  };
}

async function generateDependenciesFromLockfile(root: string, targetFile: string, options: Options): Promise<PkgTree> {
  const lockFileFullPath = path.resolve(root, targetFile);

  if (!await fs.exists(lockFileFullPath)) {
    throw new Error(`Lockfile ${targetFile} not found at location: ${lockFileFullPath}`);
  }

  const fullPath = path.parse(lockFileFullPath);
  const manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');

  if (!await fs.exists(manifestFileFullPath)) {
    throw new Error(`Manifest file package.json not found at location: ${manifestFileFullPath}`);
  }

  if (!manifestFileFullPath && lockFileFullPath) {
    throw new Error(`Detected a lockfile at location: ${lockFileFullPath}\nHowever the package.json is missing!`);
  }

  const [manifestFile, lockFile] = await Promise.all([
    await fs.readFile(manifestFileFullPath, 'utf-8'),
    await fs.readFile(lockFileFullPath, 'utf-8'),
  ]);

  const defaultManifestFileName = path.relative(root, manifestFileFullPath);
  const strictOutOfSync = _.get(options, 'strictOutOfSync') !== 'false';

  return await buildDepTree(
    manifestFile,
    lockFile,
    options.dev,
    LockfileType.npm,
    strictOutOfSync,
    defaultManifestFileName,
  );
}
