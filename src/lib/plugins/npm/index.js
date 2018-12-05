const snyk = require('../../');
const fileSystem = require('fs');
const fs = require('then-fs');
const path = require('path');
const lockFileParser = require('snyk-nodejs-lockfile-parser');

module.exports = {
  inspect,
};

function inspect(root, targetFile, options) {
  const isLockFileBased = targetFile.endsWith('package-lock.json');

  const isShrinkwrapPresent = fileSystem.existsSync(
    path.resolve(root, targetFile).dir, 'npm-shrinkwrap.json'
  );
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

  // old style npm projects
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
    throw new Error('Manifest file package.json not found at location: ' +
      manifestFileFullPath);
  }

  if (!manifestFileFullPath && lockFileFullPath) {
    throw new Error('Detected a lockfile at location: '
    + lockFileFullPath + '\n However the package.json is missing!');
  }

  const manifestFile = await fs.readFile(manifestFileFullPath, 'utf-8');
  const lockFile = await fs.readFile(lockFileFullPath, 'utf-8');
  const defaultManifestFileName = path.relative(root, manifestFileFullPath);

  return lockFileParser.buildDepTree(manifestFile, lockFile, options.dev,
    lockFileParser.LockfileType.npm, true, defaultManifestFileName);
}

