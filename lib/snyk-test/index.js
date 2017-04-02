module.exports = test;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var detect = require('../detect');
var runTest = require('./run-test');

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
    var packageManager = options.packageManager ||
      detect.detectPackageManager(root, options);
    options.packageManager = packageManager;
    return run(root, options)
    .then(function (res) {
      res.packageManager = packageManager;
      return res;
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

function run(root, options) {
  var packageManager = options.packageManager;
  if (new Set(['npm', 'yarn']).has(packageManager)) {
    return require('./npm')(root, options);
  }
  if (!new Set(['rubygems', 'maven']).has(packageManager)) {
    throw new Error('Unsupported package manager: ' + packageManager);
  }
  return runTest(packageManager, root, options);
}
