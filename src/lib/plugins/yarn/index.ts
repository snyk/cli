import * as path from 'path';
import * as fs from 'then-fs';
import * as _ from 'lodash';
import * as Debug from 'debug';
import {buildDepTree, PkgTree, LockfileType} from 'snyk-nodejs-lockfile-parser';
import * as snyk from '../../';

const debug = Debug('snyk');

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

export async function inspect(root, targetFile, options: Options = {}): Promise<InspectResult> {
  const isLockFileBased = targetFile.endsWith('yarn.lock');
  const targetFileFullPath = path.resolve(root, targetFile);
  const isShrinkwrapPresent = await fs.exists(path.join(path.dirname(targetFileFullPath), 'npm-shrinkwrap.json'));

  if (getRuntimeVersion() < 6) {
    options.traverseNodeModules = true;

    debug('Falling back to node_modules traversal for yarn.lock projects on Node < 6');
    const isNodeModulesFolderPresent = await fs.exists(path.join(root, 'node_modules'));
    if (!isNodeModulesFolderPresent) {
      // throw a custom error
      throw new Error('Missing node_modules folder: we can\'t test ' +
        'without dependencies.\nPlease run \'yarn install\' first.');
    }
  }

  if (isLockFileBased && !isShrinkwrapPresent && !options.traverseNodeModules) {
    return {
      plugin: {
        name: 'snyk-nodejs-lockfile-parser',
        runtime: process.version,
      },
      package: await generateDependenciesFromLockfile(root, options, targetFile),
    };
  }

  // Traverse node modules.
  return {
    plugin: {
      name: 'snyk-resolve-deps',
      runtime: process.version,
    },
    package: await snyk.modules(root, Object.assign({}, options, {noFromArrays: true})),
  };
}

function getRuntimeVersion(): number {
  return parseInt(process.version.slice(1).split('.')[0], 10);
}

async function generateDependenciesFromLockfile(root, options, targetFile): Promise<PkgTree> {
  const lockFileFullPath = path.resolve(root, targetFile);
  if (!await fs.exists(lockFileFullPath)) {
    throw new Error(`Lockfile ${targetFile} not found at location: ${lockFileFullPath}`);
  }

  const fullPath = path.parse(lockFileFullPath);
  const manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');

  if (!await fs.exists(manifestFileFullPath)) {
    throw new Error(`Manifest file yarn.lock not found at location: ${manifestFileFullPath}`);
  }

  if (!manifestFileFullPath && lockFileFullPath) {
    throw new Error(`Detected a lockfile at location: ${lockFileFullPath}\nHowever the yarn.lock is missing!`);
  }

  const [manifestFile, lockFile] = await Promise.all([
    await fs.readFile(manifestFileFullPath, 'utf-8'),
    await fs.readFile(lockFileFullPath, 'utf-8'),
  ]);

  const defaultManifestFileName = path.relative(root, manifestFileFullPath);
  const strictOutOfSync = _.get(options, 'strictOutOfSync') !== 'false';

  return buildDepTree(
    manifestFile,
    lockFile,
    options.dev,
    LockfileType.yarn,
    strictOutOfSync,
    defaultManifestFileName,
  );
}
