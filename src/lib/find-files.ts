import * as fs from 'fs';
import * as pathLib from 'path';
const sortBy = require('lodash.sortby');
const groupBy = require('lodash.groupby');
import { detectPackageManagerFromFile } from './detect';
import * as debugModule from 'debug';
const debug = debugModule('snyk:find-files');

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

interface FindFilesRes {
  files: string[];
  allFilesFound: string[];
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
): Promise<FindFilesRes> {
  const found: string[] = [];
  const foundAll: string[] = [];

  // ensure we ignore find against node_modules path.
  if (path.endsWith('node_modules')) {
    return { files: found, allFilesFound: foundAll };
  }
  // ensure node_modules is always ignored
  if (!ignore.includes('node_modules')) {
    ignore.push('node_modules');
  }
  try {
    if (levelsDeep < 0) {
      return { files: found, allFilesFound: foundAll };
    } else {
      levelsDeep--;
    }
    const fileStats = await getStats(path);
    if (fileStats.isDirectory()) {
      const { files, allFilesFound } = await findInDirectory(
        path,
        ignore,
        filter,
        levelsDeep,
      );
      found.push(...files);
      foundAll.push(...allFilesFound);
    } else if (fileStats.isFile()) {
      const fileFound = findFile(path, filter);
      if (fileFound) {
        found.push(fileFound);
        foundAll.push(fileFound);
      }
    }
    const filteredOutFiles = foundAll.filter((f) => !found.includes(f));
    if (filteredOutFiles.length) {
      debug(
        `Filtered out ${filteredOutFiles.length}/${
          foundAll.length
        } files: ${filteredOutFiles.join(', ')}`,
      );
    }
    return { files: filterForDefaultManifests(found), allFilesFound: foundAll };
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
): Promise<FindFilesRes> {
  const files = await readDirectory(path);
  const toFind = files
    .filter((file) => !ignore.includes(file))
    .map((file) => {
      const resolvedPath = pathLib.resolve(path, file);
      if (!fs.existsSync(resolvedPath)) {
        debug('File does not seem to exist, skipping: ', file);
        return { files: [], allFilesFound: [] };
      }
      return find(resolvedPath, ignore, filter, levelsDeep);
    });

  const found = await Promise.all(toFind);
  return {
    files: Array.prototype.concat.apply(
      [],
      found.map((f) => f.files),
    ),
    allFilesFound: Array.prototype.concat.apply(
      [],
      found.map((f) => f.allFilesFound),
    ),
  };
}

function filterForDefaultManifests(files: string[]): string[] {
  // take all the files in the same dir & filter out
  // based on package Manager
  if (files.length <= 1) {
    return files;
  }

  const filteredFiles: string[] = [];

  const beforeSort = files
    .filter(Boolean)
    .filter((p) => fs.existsSync(p))
    .map((p) => ({
      path: p,
      ...pathLib.parse(p),
      packageManager: detectProjectTypeFromFile(p),
    }));
  const sorted = sortBy(beforeSort, 'dir');
  const foundFiles = groupBy(sorted, 'dir');

  for (const directory of Object.keys(foundFiles)) {
    const filesInDirectory = foundFiles[directory];
    const beforeGroup = filesInDirectory.filter((p) => !!p.packageManager);

    const groupedFiles = groupBy(beforeGroup, 'packageManager');

    for (const packageManager of Object.keys(groupedFiles)) {
      const filesPerPackageManager = groupedFiles[packageManager];

      if (filesPerPackageManager.length <= 1) {
        const shouldSkip = shouldSkipAddingFile(
          packageManager,
          filesPerPackageManager[0].path,
          filteredFiles,
        );
        if (shouldSkip) {
          continue;
        }
        filteredFiles.push(filesPerPackageManager[0].path);
        continue;
      }
      const defaultManifestFileName = chooseBestManifest(
        filesPerPackageManager,
        packageManager,
      );
      if (defaultManifestFileName) {
        const shouldSkip = shouldSkipAddingFile(
          packageManager,
          filesPerPackageManager[0].path,
          filteredFiles,
        );
        if (shouldSkip) {
          continue;
        }
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

function shouldSkipAddingFile(
  packageManager: string,
  filePath: string,
  filteredFiles: string[],
): boolean {
  if (['gradle'].includes(packageManager) && filePath) {
    const rootGradleFile = filteredFiles
      .filter(
        (targetFile) =>
          targetFile.endsWith('build.gradle') ||
          targetFile.endsWith('build.gradle.kts'),
      )
      .filter((targetFile) => {
        const parsedPath = pathLib.parse(targetFile);
        const relativePath = pathLib.relative(parsedPath.dir, filePath);
        return !relativePath.startsWith(`..${pathLib.sep}`);
      });
    return !!rootGradleFile.length;
  }
  return false;
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
      debug(
        `Encountered multiple node lockfiles files, defaulting to ${lockFile.path}`,
      );
      if (lockFile) {
        return lockFile.path;
      }
      const packageJson = files.filter((path) =>
        ['package.json'].includes(path.base),
      )[0];
      debug(
        `Encountered multiple npm manifest files, defaulting to ${packageJson.path}`,
      );
      return packageJson.path;
    }
    case 'rubygems': {
      const defaultManifest = files.filter((path) =>
        ['Gemfile.lock'].includes(path.base),
      )[0];
      debug(
        `Encountered multiple gem manifest files, defaulting to ${defaultManifest.path}`,
      );
      return defaultManifest.path;
    }
    case 'cocoapods': {
      const defaultManifest = files.filter((path) =>
        ['Podfile'].includes(path.base),
      )[0];
      debug(
        `Encountered multiple cocoapods manifest files, defaulting to ${defaultManifest.path}`,
      );
      return defaultManifest.path;
    }
    case 'pip': {
      const defaultManifest = files.filter((path) =>
        ['Pipfile'].includes(path.base),
      )[0];
      debug(
        `Encountered multiple pip manifest files, defaulting to ${defaultManifest.path}`,
      );
      return defaultManifest.path;
    }
    case 'gradle': {
      const defaultManifest = files.filter((path) =>
        ['build.gradle'].includes(path.base),
      )[0];
      debug(
        `Encountered multiple gradle manifest files, defaulting to ${defaultManifest.path}`,
      );
      return defaultManifest.path;
    }
    case 'poetry': {
      const defaultManifest = files.filter((path) =>
        ['pyproject.toml'].includes(path.base),
      )[0];
      debug(
        `Encountered multiple poetry manifest files, defaulting to ${defaultManifest.path}`,
      );
      return defaultManifest.path;
    }
    case 'hex': {
      const defaultManifest = files.filter((path) =>
        ['mix.exs'].includes(path.base),
      )[0];
      debug(
        `Encountered multiple hex manifest files, defaulting to ${defaultManifest.path}`,
      );
      return defaultManifest.path;
    }
    default: {
      return null;
    }
  }
}
