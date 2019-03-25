module.exports = test;

var detect = require('../detect');
var runTest = require('./run-test');
var chalk = require('chalk');

function test(root, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (!options) {
    options = {};
  }

  var promise = executeTest(root, options);
  if (callback) {
    promise.then(function (res) {
      callback(null, res);
    }).catch(callback);
  }
  return promise;
}

function executeTest(root, options) {
  try {
    var packageManager = detect.detectPackageManager(root, options);
    options.packageManager = packageManager;
    return run(root, options)
      .then(function (results) {
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

function run(root, options) {
  var packageManager = options.packageManager;
  if (['npm', 'yarn'].indexOf(packageManager) >= 0) {
    return require('./npm')(root, options);
  }
  if (!options.docker && [
    'rubygems',
    'maven',
    'gradle',
    'sbt',
    'pip',
    'golangdep',
    'govendor',
    'nuget',
    'paket',
    'composer',
  ].indexOf(packageManager) === -1) {
    throw new Error('Unsupported package manager: ' + packageManager);
  }
  return runTest(packageManager, root, options);
}
