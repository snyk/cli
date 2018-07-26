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
    .then(function (res) {
      if (!res.packageManager) {
        res.packageManager = packageManager;
      }
      return res;
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
    'composer',
  ].indexOf(packageManager) === -1) {
    throw new Error('Unsupported package manager: ' + packageManager);
  }
  return runTest(packageManager, root, options);
}
