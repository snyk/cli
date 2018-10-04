const snyk = require('../../');
const fileSystem = require('fs');
const fs = require('then-fs');
const path = require('path');
const lockFileParser = require('snyk-nodejs-lockfile-parser');
const debug = require('debug')('snyk');
const getRuntimeVersion = require('../../get-node-runtime-version');

module.exports = {
  inspect,
};

async function inspect(root, targetFile, options) {
  const isLockFileBased = targetFile.endsWith('yarn.lock');

  const isShrinkwrapPresent = fileSystem.existsSync(
    path.resolve(root, targetFile).dir, 'npm-shrinkwrap.json'
  );

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
    return generateDependenciesFromLockfile(root, options, targetFile)
      .then((modules) => ({
        plugin: {
          name: 'snyk-nodejs-lockfile-parser',
          runtime: process.version,
        },
        package: modules,
      }));
  }

  // traverse node modules
  return snyk.modules(root, Object.assign({}, options, {noFromArrays: true}))
    .then(function (modules) {
      return {
        plugin: {
          name: 'snyk-resolve-deps',
          runtime: process.version,
        },
        package: modules,
      };
    });
}

async function generateDependenciesFromLockfile(root, options, targetFile) {
  const lockFileFullPath = path.resolve(root, targetFile);
  if (!fileSystem.existsSync(lockFileFullPath)) {
    throw new Error('Lockfile ' + targetFile + ' not found at location: ' +
    lockFileFullPath);
  }

  const fullPath = path.parse(lockFileFullPath);
  const manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');

  if (!fileSystem.existsSync(manifestFileFullPath)) {
    throw new Error('Manifest file yarn.lock not found at location: ' +
      manifestFileFullPath);
  }

  if (!manifestFileFullPath && lockFileFullPath) {
    throw new Error('Detected a lockfile at location: '
    + lockFileFullPath + '\n However the yarn.lock is missing!');
  }

  const manifestFile = await fs.readFile(manifestFileFullPath, 'utf-8');
  const lockFile = await fs.readFile(lockFileFullPath, 'utf-8');

  return lockFileParser
    .buildDepTree(manifestFile, lockFile, options.dev, lockFileParser.LockfileType.yarn);
}

