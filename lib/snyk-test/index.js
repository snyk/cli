module.exports = test;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var detect = require('../detect');

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
    var runner = loadTestRunner(packageManager);
    return runner(root, options)
    .then(function (res) {
      res.packageManager = packageManager;
      return res;
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

function loadTestRunner(packageManager) {
  switch (packageManager) {
    case 'npm': {
      return require('./npm');
    }
    case 'rubygems': {
      return require('./rubygems');
    }
    case 'maven': {
      return require('./maven');
    }
    default: {
      throw new Error('Unsupported package manager: ' + packageManager);
    }
  }
}
