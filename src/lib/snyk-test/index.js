module.exports = test;

const detect = require('../detect');
const runTest = require('./run-test');
const chalk = require('chalk');
const pm = require('../package-managers');
const { UnsupportedPackageManagerError } = require('../errors');
const {getSearchPath, findGlobs} = require('./find-globs');

function test(root, options, callback) {

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (!options) {
    options = {};
  }
  const searchPath = getSearchPath();
  const targetFiles = findGlobs(searchPath);

  console.log('**** targetFiles', targetFiles);

  const promise = executeTest(root, options, targetFiles);
  if (callback) {
    promise
      .then((res) => {
        callback(null, res);
      })
      .catch(callback);
  }
  return promise;
}

function executeTest(root, options, targetFiles) {
  try {
    const packageManager = detect.detectPackageManager(root, options);
    options.packageManager = packageManager;
    return run(root, options, targetFiles).then((results) => {
      for (const res of results) {
        if (!res.packageManager) {
          res.packageManager = packageManager;
        }
      }
      if (results.length === 1) {
        // Return only one result if only one found as this is the default usecase
        return results[0];
      }
      // For gradle and yarnWorkspaces we may be returning more than one result
      return results;
    });
  } catch (error) {
    return Promise.reject(chalk.red.bold(error));
  }
}

function run(root, options, targetFiles) {
  const packageManager = options.packageManager;
  if (!(options.docker || pm.SUPPORTED_PACKAGE_MANAGER_NAME[packageManager])) {
    throw new UnsupportedPackageManagerError(packageManager);
  }
  return runTest(packageManager, root, options, targetFiles);
}
