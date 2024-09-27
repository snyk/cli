import * as fs from 'fs';
import * as pathLib from 'path';

import * as sortBy from 'lodash.sortby';
import * as groupBy from 'lodash.groupby';
import { detectPackageManagerFromFile } from './detect';
import * as debugModule from 'debug';
import {
  PNPM_FEATURE_FLAG,
  SUPPORTED_MANIFEST_FILES,
} from './package-managers';
import * as merge from 'lodash.merge';
import { MAX_DETECTION_DEPTH } from './constants';

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

const ignoreFolders = ['node_modules', '.build'];

interface FindFilesConfig {
  path: string;
  ignore: string[];
  filter: string[];
  levelsDeep: number;
  featureFlags: Set<string>;
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
  findConfig: Partial<FindFilesConfig>,
): Promise<FindFilesRes> {
  const config = getFindConfig(findConfig);
  const found: string[] = [];
  const foundAll: string[] = [];

  // ensure we ignore find against node_modules path and .build folder for swift.
  if (config.path.endsWith('node_modules') || config.path.endsWith('/.build')) {
    return { files: found, allFilesFound: foundAll };
  }

  // ensure dependencies folders is always ignored
  for (const folder of ignoreFolders) {
    if (!config.ignore.includes(folder)) {
      config.ignore.push(folder);
    }
  }

  try {
    if (config.levelsDeep < 0) {
      return { files: found, allFilesFound: foundAll };
    } else {
      config.levelsDeep--;
    }
    const fileStats = await getStats(config.path);
    if (fileStats.isDirectory()) {
      const { files, allFilesFound } = await findInDirectory(config);
      found.push(...files);
      foundAll.push(...allFilesFound);
    } else if (fileStats.isFile()) {
      const fileFound = findFile(config.path, config.filter);
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
    return {
      files: filterForDefaultManifests(found, config.featureFlags),
      allFilesFound: foundAll,
    };
  } catch (err) {
    throw new Error(
      `Error finding files in path '${config.path}'.\n${err.message}`,
    );
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

function getFindConfig(option: Partial<FindFilesConfig>): FindFilesConfig {
  const result = merge(
    {
      path: '',
      ignore: [],
      filter: [],
      levelsDeep: MAX_DETECTION_DEPTH,
      featureFlags: new Set<string>(),
    },
    option,
  );

  if (isNaN(result.levelsDeep) || result.levelsDeep === null) {
    result.levelsDeep = MAX_DETECTION_DEPTH;
  }
  return result;
}

async function findInDirectory(
  findConfig: FindFilesConfig,
): Promise<FindFilesRes> {
  const config = getFindConfig(findConfig);
  const files = await readDirectory(config.path);
  const toFind = files
    .filter((file) => !config.ignore.includes(file))
    .map((file) => {
      const resolvedPath = pathLib.resolve(config.path, file);
      if (!fs.existsSync(resolvedPath)) {
        debug('File does not seem to exist, skipping: ', file);
        return { files: [], allFilesFound: [] };
      }
      const findconfig = {
        ...config,
        path: resolvedPath,
      };
      return find(findconfig);
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

function filterForDefaultManifests(
  files: string[],
  featureFlags: Set<string> = new Set<string>(),
): string[] {
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
      packageManager: detectProjectTypeFromFile(p, featureFlags),
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
        featureFlags,
      );
      if (defaultManifestFileName) {
        const shouldSkip = shouldSkipAddingFile(
          packageManager,
          filesPerPackageManager[0].path, // defaultManifestFileName?
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

function detectProjectTypeFromFile(
  file: string,
  featureFlags: Set<string> = new Set<string>(),
): string | null {
  try {
    const packageManager = detectPackageManagerFromFile(file, featureFlags);
    if (['yarn', 'npm'].includes(packageManager)) {
      return 'node';
    }
    if (featureFlags.has(PNPM_FEATURE_FLAG) && packageManager === 'pnpm') {
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
  featureFlags: Set<string> = new Set<string>([]),
): string | null {
  switch (projectType) {
    case 'node': {
      const nodeLockfiles = [
        SUPPORTED_MANIFEST_FILES.PACKAGE_LOCK_JSON as string,
        SUPPORTED_MANIFEST_FILES.YARN_LOCK as string,
      ];
      if (featureFlags.has(PNPM_FEATURE_FLAG)) {
        nodeLockfiles.push(SUPPORTED_MANIFEST_FILES.PNPM_LOCK as string);
      }
      const lockFile = files.filter((path) =>
        nodeLockfiles.includes(path.base),
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
