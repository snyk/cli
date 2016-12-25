module.exports = {
  detectPackageManager: detectPackageManager,
  detectPackageFile: detectPackageFile,
};

var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var path = require('path');

var DETECTABLE_FILES = [
  'package.json',
  'Gemfile',
  'Gemfile.lock',
];

var DETECTABLE_PACKAGE_MANAGERS = {
  Gemfile: 'rubygems',
  'Gemfile.lock': 'rubygems',
  '.gemspec': 'rubygems',
  'package.json': 'npm',
  'pom.xml': 'maven',
};

function detectPackageManager(root, options) {
  var packageManager;
  if (isCodeTest(root)) {
    var file = options.file || detectPackageFile(root) || 'package.json';
    packageManager = detectPackageManagerFromFile(file);
  } else {
    var registry = options.registry || 'npm';
    packageManager = detectPackageManagerFromRegistry(registry);
  }
  return packageManager;
}

function isCodeTest(root) {
  return isRepo(root) || fs.existsSync(root);
}

function isRepo(root) {
  return root.indexOf('github.com') !== -1;
}

function detectPackageFile(root) {
  for (var i = 0; i < DETECTABLE_FILES.length; i++) {
    var file = DETECTABLE_FILES[i];
    if (fs.existsSync(path.resolve(root, file))) {
      return file;
    }
  }
  return null;
}

function detectPackageManagerFromFile(file) {
  var key = path.basename(file);
  if (/\.gemspec$/.test(key)) {
    key = '.gemspec';
  }
  if (!(key in DETECTABLE_PACKAGE_MANAGERS)) {
    throw new Error('Could not detect package manager for file: ' + file);
  }
  return DETECTABLE_PACKAGE_MANAGERS[key];
}

function detectPackageManagerFromRegistry(registry) {
  return registry;
}
