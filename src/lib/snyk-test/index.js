module.exports = test;

const detect = require('../detect');
const runTest = require('./run-test');
const chalk = require('chalk');
const pm = require('../package-managers');
const { UnsupportedPackageManagerError } = require('../errors');

async function test(root, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (!options) {
    options = {};
  }
  const promise = executeTest(root, options);
  if (callback) {
    promise
      .then((res) => {
        callback(null, res);
      })
      .catch(callback);
  }
  return promise;
}

function executeTest(root, options) {
  try {
    if (!options.allProjects) {
      options.packageManager = detect.detectPackageManager(root, options);
    }
    return run(root, options).then((results) => {
      for (const res of results) {
        if (!res.packageManager) {
          res.packageManager = options.packageManager;
        }
      }
      if (results.length === 1) {
        // Return only one result if only one found as this is the default usecase
        return results[0];
      }
      // For gradle, yarnWorkspaces, allProjects we may be returning more than one result
      return results;
    });
  } catch (error) {
    return Promise.reject(chalk.red.bold(error));
  }
}

function run(root, options) {
  const packageManager = options.packageManager;
  if (
    !(
      options.docker ||
      options.allProjects ||
      pm.SUPPORTED_PACKAGE_MANAGER_NAME[packageManager]
    )
  ) {
    throw new UnsupportedPackageManagerError(packageManager);
  }
  return runTest(packageManager, root, options);
}
