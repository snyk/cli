import * as fs from 'then-fs';
import * as pathLib from 'path';
import * as debugLib from 'debug';
import chalk from 'chalk';
import * as _ from 'lodash';

const debug = debugLib('snyk');

const DETECTABLE_FILES = [
  'yarn.lock',
  'package-lock.json',
  'package.json',
  'Gemfile',
  'Gemfile.lock',
  'pom.xml',
  'build.gradle',
  'build.sbt',
  'Pipfile',
  'requirements.txt',
  'Gopkg.lock',
  'vendor/vendor.json',
  'obj/project.assets.json',
  'project.assets.json',
  'packages.config',
  'composer.lock',
];

// when file is specified with --file, we look it up here
/*tslint:disable object-literal-sort-keys*/
const DETECTABLE_PACKAGE_MANAGERS = {
  'Gemfile': 'rubygems',
  'Gemfile.lock': 'rubygems',
  '.gemspec': 'rubygems',
  'package-lock.json': 'npm',
  'pom.xml': 'maven',
  'build.gradle': 'gradle',
  'build.sbt': 'sbt',
  'yarn.lock': 'yarn',
  'package.json': 'npm',
  'Pipfile': 'pip',
  'requirements.txt': 'pip',
  'Gopkg.lock': 'golangdep',
  'vendor.json': 'govendor',
  'project.assets.json': 'nuget',
  'packages.config': 'nuget',
  'project.json': 'nuget',
  'composer.lock': 'composer',
};
/*tslint:enable object-literal-sort-keys*/

export function isPathToPackageFile(path) {
  for (const fileName of DETECTABLE_FILES) {
    if (_.endsWith(path, fileName)) {
      return true;
    }
  }
  return false;
}

export function detectPackageManager(root, options) {
  // If user specified a package manager let's use it.
  if (options.packageManager) {
    return options.packageManager;
  }
  // The package manager used by a docker container is not known ahead of time
  if (options.docker) {
    return undefined;
  }

  let packageManager;
  let file;
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
    debug('specified paramater is not a folder, trying to lookup as repo');
    const registry = options.registry || 'npm';
    packageManager = detectPackageManagerFromRegistry(registry);
  }
  if (!packageManager) {
    throw new Error('Could not detect supported target files in ' + root +
      '.\nPlease see our documentation for supported languages and ' +
      'target files: ' +
      chalk.underline(
        'https://support.snyk.io/getting-started/languages-support',
      ) +
      ' and make sure you are in the right directory.');
  }
  return packageManager;
}

// User supplied a "local" file, but that file doesn't exist
function localFileSuppliedButNotFound(root, file) {
  return file && fs.existsSync(root) &&
    !fs.existsSync(pathLib.resolve(root, file));
}

function isLocalFolder(root) {
  try {
    return fs.lstatSync(root).isDirectory();
  } catch (e) {
    return false;
  }
}

export function detectPackageFile(root) {
  for (const file of DETECTABLE_FILES) {
    if (fs.existsSync(pathLib.resolve(root, file))) {
      debug('found package file ' + file + ' in ' + root);
      return file;
    }
  }

  debug('no package file found in ' + root);
}

function detectPackageManagerFromFile(file) {
  let key = pathLib.basename(file);

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
