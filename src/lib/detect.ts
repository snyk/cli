import * as fs from 'fs';
import * as pathLib from 'path';
import * as debugLib from 'debug';
import { NoSupportedManifestsFoundError } from './errors';
import {
  SupportedPackageManagers,
  SUPPORTED_MANIFEST_FILES,
} from './package-managers';

const debug = debugLib('snyk-detect');

const DETECTABLE_FILES: string[] = [
  'yarn.lock',
  'package-lock.json',
  'package.json',
  'Gemfile',
  'Gemfile.lock',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'build.sbt',
  'Pipfile',
  'requirements.txt',
  'Gopkg.lock',
  'go.mod',
  'vendor/vendor.json',
  'obj/project.assets.json',
  'project.assets.json',
  'packages.config',
  'paket.dependencies',
  'composer.lock',
  'Podfile',
  'Podfile.lock',
  'poetry.lock',
  'mix.exs',
  'mix.lock',
  'Package.swift',
];

export const AUTO_DETECTABLE_FILES: string[] = [
  'package-lock.json',
  'yarn.lock',
  'package.json',
  'Gemfile',
  'Gemfile.lock',
  'pom.xml',
  'packages.config',
  'paket.dependencies',
  'project.json',
  'project.assets.json',
  'Podfile',
  'Podfile.lock',
  'composer.lock',
  'Gopkg.lock',
  'go.mod',
  'vendor.json',
  'Pipfile',
  'requirements.txt',
  'build.sbt',
  'build.gradle',
  'build.gradle.kts',
  'poetry.lock',
  'mix.exs',
  'mix.lock',
  'Package.swift',
];

// when file is specified with --file, we look it up here
// this is also used when --all-projects flag is enabled and auto detection plugin is triggered
const DETECTABLE_PACKAGE_MANAGERS: {
  [key in SUPPORTED_MANIFEST_FILES]: SupportedPackageManagers;
} = {
  [SUPPORTED_MANIFEST_FILES.GEMFILE]: 'rubygems',
  [SUPPORTED_MANIFEST_FILES.GEMFILE_LOCK]: 'rubygems',
  [SUPPORTED_MANIFEST_FILES.GEMSPEC]: 'rubygems',
  [SUPPORTED_MANIFEST_FILES.PACKAGE_LOCK_JSON]: 'npm',
  [SUPPORTED_MANIFEST_FILES.POM_XML]: 'maven',
  [SUPPORTED_MANIFEST_FILES.JAR]: 'maven',
  [SUPPORTED_MANIFEST_FILES.WAR]: 'maven',
  [SUPPORTED_MANIFEST_FILES.BUILD_GRADLE]: 'gradle',
  [SUPPORTED_MANIFEST_FILES.BUILD_GRADLE_KTS]: 'gradle',
  [SUPPORTED_MANIFEST_FILES.BUILD_SBT]: 'sbt',
  [SUPPORTED_MANIFEST_FILES.YARN_LOCK]: 'yarn',
  [SUPPORTED_MANIFEST_FILES.PACKAGE_JSON]: 'npm',
  [SUPPORTED_MANIFEST_FILES.PIPFILE]: 'pip',
  [SUPPORTED_MANIFEST_FILES.SETUP_PY]: 'pip',
  [SUPPORTED_MANIFEST_FILES.REQUIREMENTS_TXT]: 'pip',
  [SUPPORTED_MANIFEST_FILES.GOPKG_LOCK]: 'golangdep',
  [SUPPORTED_MANIFEST_FILES.GO_MOD]: 'gomodules',
  [SUPPORTED_MANIFEST_FILES.VENDOR_JSON]: 'govendor',
  [SUPPORTED_MANIFEST_FILES.PROJECT_ASSETS_JSON]: 'nuget',
  [SUPPORTED_MANIFEST_FILES.PACKAGES_CONFIG]: 'nuget',
  [SUPPORTED_MANIFEST_FILES.PROJECT_JSON]: 'nuget',
  [SUPPORTED_MANIFEST_FILES.PAKET_DEPENDENCIES]: 'paket',
  [SUPPORTED_MANIFEST_FILES.COMPOSER_LOCK]: 'composer',
  [SUPPORTED_MANIFEST_FILES.PODFILE_LOCK]: 'cocoapods',
  [SUPPORTED_MANIFEST_FILES.COCOAPODS_PODFILE_YAML]: 'cocoapods',
  [SUPPORTED_MANIFEST_FILES.COCOAPODS_PODFILE]: 'cocoapods',
  [SUPPORTED_MANIFEST_FILES.PODFILE]: 'cocoapods',
  [SUPPORTED_MANIFEST_FILES.POETRY_LOCK]: 'poetry',
  [SUPPORTED_MANIFEST_FILES.MIX_EXS]: 'hex',
  [SUPPORTED_MANIFEST_FILES.PACKAGE_SWIFT]: 'swift',
};

export function isPathToPackageFile(path: string) {
  for (const fileName of DETECTABLE_FILES) {
    if (path.endsWith(fileName)) {
      return true;
    }
  }
  return false;
}

export function detectPackageManager(root: string, options) {
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
          'Could not find the specified file: ' +
            options.file +
            '\nPlease check that it exists and try again.',
        );
      }
      file = options.file;
      packageManager = detectPackageManagerFromFile(file);
    } else if (options.scanAllUnmanaged) {
      packageManager = 'maven';
    } else {
      debug('no file specified. Trying to autodetect in base folder ' + root);
      file = detectPackageFile(root);
      if (file) {
        packageManager = detectPackageManagerFromFile(file);
      }
    }
  } else {
    debug('specified parameter is not a folder, trying to lookup as repo');
    const registry = options.registry || 'npm';
    packageManager = detectPackageManagerFromRegistry(registry);
  }
  if (!packageManager) {
    throw NoSupportedManifestsFoundError([root]);
  }
  return packageManager;
}

// User supplied a "local" file, but that file doesn't exist
export function localFileSuppliedButNotFound(root, file) {
  return (
    file && fs.existsSync(root) && !fs.existsSync(pathLib.resolve(root, file))
  );
}

export function isLocalFolder(root: string) {
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

export function detectPackageManagerFromFile(
  file: string,
): SupportedPackageManagers {
  let key = pathLib.basename(file);

  // TODO: fix this to use glob matching instead
  // like *.gemspec
  if (/\.gemspec$/.test(key)) {
    key = '.gemspec';
  }

  if (/\.jar$/.test(key)) {
    key = '.jar';
  }

  if (/\.war$/.test(key)) {
    key = '.war';
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
