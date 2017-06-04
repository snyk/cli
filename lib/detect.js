module.exports = {
  detectPackageManager: detectPackageManager,
  detectPackageFile: detectPackageFile,
};

var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var path = require('path');

var DETECTABLE_FILES = [
  'yarn.lock',
  'package.json',
  'Gemfile',
  'Gemfile.lock',
  'pom.xml',
  'build.gradle',
  'requirements.txt',
];

var DETECTABLE_PACKAGE_MANAGERS = {
  Gemfile: 'rubygems',
  'Gemfile.lock': 'rubygems',
  '.gemspec': 'rubygems',
  'package.json': 'npm',
  'pom.xml': 'maven',
  'build.gradle': 'gradle',
  'yarn.lock': 'yarn',
  'requirements.txt': 'pip',
};

function detectPackageManager(root, options) {
  var packageManager;
  if (isCodeTest(root)) {
    if (localFileSuppliedButNotFound(root, options.file)) {
      throw new Error('File not found: ' + options.file);
    }
    var file = options.file || detectPackageFile(root) || 'package.json';
    packageManager = detectPackageManagerFromFile(file);
  } else {
    var registry = options.registry || 'npm';
    packageManager = detectPackageManagerFromRegistry(registry);
  }
  return packageManager;
}

// User supplied a "local" file, but that file doesn't exist
function localFileSuppliedButNotFound(root, file) {
  return file && fs.existsSync(root) &&
    !fs.existsSync(path.resolve(root, file));
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
