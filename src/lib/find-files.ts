import * as fs from 'fs';
import * as pathLib from 'path';
import * as _ from '@snyk/lodash';
import { detectPackageManagerFromFile } from './detect';
import * as debugModule from 'debug';
const debug = debugModule('snyk');

// TODO: use util.promisify once we move to node 8

/**
 * Returns files inside given file path.
 *
 * @param path file path.
 */
export async function readDirectory(path: string): Promise<string[]> {
  return await new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => {
      if (err) {
        reject(err);
      }
      resolve(files);
    });
  });
}

/**
 * Returns file stats object for given file path.
 *
 * @param path path to file or directory.
 */
export async function getStats(path: string): Promise<fs.Stats> {
  return await new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      if (err) {
        reject(err);
      }
      resolve(stats);
    });
  });
}

/**
 * Find all files in given search path. Returns paths to files found.
 *
 * @param path file path to search.
 * @param ignore (optional) files to ignore. Will always ignore node_modules.
 * @param filter (optional) file names to find. If not provided all files are returned.
 * @param levelsDeep (optional) how many levels deep to search, defaults to two, this path and one sub directory.
 */
export async function find(
  path: string,
  ignore: string[] = [],
  filter: string[] = [],
  levelsDeep = 4,
): Promise<string[]> {
  const found: string[] = [];
  // ensure we ignore find against node_modules path.
  if (path.endsWith('node_modules')) {
    return found;
  }
  // ensure node_modules is always ignored
  if (!ignore.includes('node_modules')) {
    ignore.push('node_modules');
  }
  try {
    if (levelsDeep < 0) {
      return found;
    } else {
      levelsDeep--;
    }
    const fileStats = await getStats(path);
    if (fileStats.isDirectory()) {
      const files = await findInDirectory(path, ignore, filter, levelsDeep);
      found.push(...files);
    } else if (fileStats.isFile()) {
      const fileFound = findFile(path, filter);
      if (fileFound) {
        found.push(fileFound);
      }
    }
    return filterForDefaultManifests(found);
  } catch (err) {
    throw new Error(`Error finding files in path '${path}'.\n${err.message}`);
  }
}

function findFile(path: string, filter: string[] = []): string | null {
  if (filter.length > 0) {
    const filename = pathLib.basename(path);
    if (filter.includes(filename)) {
      return path;
    }
  } else {
    return path;
  }
  return null;
}

async function findInDirectory(
  path: string,
  ignore: string[] = [],
  filter: string[] = [],
  levelsDeep = 4,
): Promise<string[]> {
  const files = await readDirectory(path);
  const toFind = files
    .filter((file) => !ignore.includes(file))
    .map((file) => {
      const resolvedPath = pathLib.resolve(path, file);
      return find(resolvedPath, ignore, filter, levelsDeep);
    });
  const found = await Promise.all(toFind);
  return Array.prototype.concat.apply([], found);
}

function filterForDefaultManifests(files: string[]) {
  // take all the files in the same dir & filter out
  // based on package Manager
  if (files.length <= 1) {
    return files;
  }

  const filteredFiles: string[] = [];

  const foundFiles = _(files)
    .filter(Boolean)
    .map((p) => ({
      path: p,
      ...pathLib.parse(p),
      packageManager: detectProjectTypeFromFile(p),
    }))
    .groupBy('dir')
    .value();

  for (const directory of Object.keys(foundFiles)) {
    const filesInDirectory = foundFiles[directory];
    if (filesInDirectory.length <= 1) {
      filteredFiles.push(filesInDirectory[0].path);
      continue;
    }

    const groupedFiles = _(filesInDirectory)
      .groupBy('packageManager')
      .value();

    for (const packageManager of Object.keys(groupedFiles)) {
      const filesPerPackageManager = groupedFiles[packageManager];
      if (filesPerPackageManager.length <= 1) {
        filteredFiles.push(filesPerPackageManager[0].path);
        continue;
      }
      const defaultManifestFileName = chooseBestManifest(
        filesPerPackageManager,
        packageManager,
      );
      if (defaultManifestFileName) {
        filteredFiles.push(defaultManifestFileName);
      }
    }
  }
  return filteredFiles;
}

function detectProjectTypeFromFile(file: string): string | null {
  try {
    const packageManager = detectPackageManagerFromFile(file);
    if (['yarn', 'npm'].includes(packageManager)) {
      return 'node';
    }
    return packageManager;
  } catch (error) {
    return null;
  }
}

function chooseBestManifest(
  files: Array<{ base: string; path: string }>,
  projectType: string,
): string | null {
  switch (projectType) {
    case 'node': {
      const lockFile = files.filter((path) =>
        ['package-lock.json', 'yarn.lock'].includes(path.base),
      )[0];
      if (lockFile) {
        debug(
          'Encountered multiple npm manifest files, defaulting to package-lock.json / yarn.lock',
        );
        return lockFile.path;
      }
      const packageJson = files.filter((path) =>
        ['package.json'].includes(path.base),
      )[0];
      debug(
        'Encountered multiple npm manifest files, defaulting to package.json',
      );
      return packageJson.path;
    }
    case 'rubygems': {
      debug(
        'Encountered multiple gem manifest files, defaulting to Gemfile.lock',
      );
      const defaultManifest = files.filter((path) =>
        ['Gemfile.lock'].includes(path.base),
      )[0];
      return defaultManifest.path;
    }
    case 'cocoapods': {
      debug(
        'Encountered multiple cocoapod manifest files, defaulting to Podfile',
      );
      const defaultManifest = files.filter((path) =>
        ['Podfile'].includes(path.base),
      )[0];
      return defaultManifest.path;
    }
    case 'pip': {
      debug('Encountered multiple pip manifest files, defaulting to Pipfile');
      const defaultManifest = files.filter((path) =>
        ['Pipfile'].includes(path.base),
      )[0];
      return defaultManifest.path;
    }
    default: {
      return null;
    }
  }
}
