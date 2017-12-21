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
  /\.csproj$/,
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
  '.csproj': 'nuget',
  'packages.config': 'nuget',
  'project.json': 'nuget',
  'composer.lock': 'composer',
};

function detectPackageManager(root, options) {
  // If user specified a package manager let's use it.
  if (options.packageManager) {
    return options.packageManager;
  }

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
  var found = false;
  for (var i = 0; i < DETECTABLE_FILES.length; i++) {
    var file = DETECTABLE_FILES[i];
    if (file instanceof RegExp) {
      var fileFound = returnFileFromRegex(root, file);
      if (fileFound) {
        return fileFound;
      }
    } else {
      if (fs.existsSync(path.resolve(root, file))) {
        return file;
      }
    }
  }
  return null;
}

function returnFileFromRegex(root, regex) {
  try {
    var files = fs.readdirSync(path.resolve(root, './'));
    return files.find(function (word, index) {
      if (regex.test(word)) {
        return files[index];
      }
    });
  } catch (e) {
    debug('could not resolve: ' + root + ' and ./');
    return false;
  }
}

function detectPackageManagerFromFile(file) {
  var key = path.basename(file);
  if (/\.gemspec$/.test(key)) {
    key = '.gemspec';
  } else if (/\.csproj$/.test(key)) {
    key = '.csproj';
  }
  if (!(key in DETECTABLE_PACKAGE_MANAGERS)) {
    throw new Error('Could not detect package manager for file: ' + file);
  }
  return DETECTABLE_PACKAGE_MANAGERS[key];
}

function detectPackageManagerFromRegistry(registry) {
  return registry;
}
