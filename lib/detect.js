module.exports = {
  detectPackageManager: detectPackageManager,
  detectPackageFile: detectPackageFile,
};

var Promise = require('es6-promise').Promise; // jshint ignore:line
var fs = require('then-fs');
var path = require('path');
var debug = require('debug')('snyk');

var DETECTABLE_FILES = [
  'yarn.lock',
  'package.json',
  'Gemfile',
  'Gemfile.lock',
  'pom.xml',
  'build.gradle',
  'build.sbt',
  'requirements.txt',
  'Gopkg.lock',
  'vendor/vendor.json',
  'obj/project.assets.json',
  'project.assets.json',
  'packages.config',
  'composer.lock',
];

// when file is specified with --file, we look it up here
var DETECTABLE_PACKAGE_MANAGERS = {
  Gemfile: 'rubygems',
  'Gemfile.lock': 'rubygems',
  '.gemspec': 'rubygems',
  'package.json': 'npm',
  'pom.xml': 'maven',
  'build.gradle': 'gradle',
  'build.sbt': 'sbt',
  'yarn.lock': 'yarn',
  'requirements.txt': 'pip',
  'Gopkg.lock': 'golangdep',
  'vendor.json': 'govendor',
  'project.assets.json': 'nuget',
  'packages.config': 'nuget',
  'project.json': 'nuget',
  'composer.lock': 'composer',
};

function detectPackageManager(root, options) {
  // If user specified a package manager let's use it.
  if (options.packageManager) {
    return options.packageManager;
  }

  var packageManager, file;
  if (isLocalFolder(root)) {
    if (options.file) {
      if (localFileSuppliedButNotFound(root, options.file)) {
        throw new Error(
          'Could not find the specified file: ' + options.file +
          '\nPlease check that it exists and try again.');
      }
      file = options.file;
      packageManager = detectPackageManagerFromFile(file);
    } else {
      debug('no file specified. Trying to autodetect in base folder ' + root);
      file = detectPackageFile(root);
      if (file) {
        packageManager = detectPackageManagerFromFile(file);
      }
    }
  } else {
    debug('specified paramater is not a folder, trying to lookup as repo')
    var registry = options.registry || 'npm';
    packageManager = detectPackageManagerFromRegistry(registry);
  }
  if (!packageManager) {
    throw new Error('Could not autodetect package manager for ' + root);
  }
  return packageManager;
}

// User supplied a "local" file, but that file doesn't exist
function localFileSuppliedButNotFound(root, file) {
  return file && fs.existsSync(root) &&
    !fs.existsSync(path.resolve(root, file));
}

function isLocalFolder(root) {
  try {
    return fs.lstatSync(root).isDirectory();
  } catch (e) {}
  return false;
}

function detectPackageFile(root) {
  for (var i = 0; i < DETECTABLE_FILES.length; i++) {
    var file = DETECTABLE_FILES[i];
    debug('trying to autodetect for ' +
      path.basename(path.resolve(root, file)));
    if (fs.existsSync(path.resolve(root, file))) {
      return file;
    }
  }
}

function detectPackageManagerFromFile(file) {
  var key = path.basename(file);
  if (/\.gemspec$/.test(key)) {
    key = '.gemspec';
  }

  if (!(key in DETECTABLE_PACKAGE_MANAGERS)) {
    // we throw and error here because the file was specified by the user
    throw new Error('Could not detect package manager for file: ' + file);
  }
  return DETECTABLE_PACKAGE_MANAGERS[key];
}

function detectPackageManagerFromRegistry(registry) {
  return registry;
}
