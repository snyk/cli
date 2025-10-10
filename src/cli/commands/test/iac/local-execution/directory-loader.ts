import * as path from 'path';
import { makeFileAndDirectoryGenerator } from './file-utils';
import { VALID_FILE_TYPES } from './types';
import { isLocalFolder } from '../../../../../lib/detect';

/**
 * Gets all nested directories for the path that we ran a scan.
 * @param pathToScan - the path to scan provided by the user
 * @param maxDepth? - An optional `maxDepth` argument can be provided to limit how deep in the file tree the search will go.
 * @param exclude? - An optional comma-separated list of directories/files to exclude
 * @returns {string[]} An array with all the non-empty nested directories in this path
 */
export function getAllDirectoriesForPath(
  pathToScan: string,
  maxDepth?: number,
  exclude?: string,
): string[] {
  // if it is a single file (it has an extension), we return the current path
  if (!isLocalFolder(pathToScan)) {
    return [path.resolve(pathToScan)];
  }
  return [...getAllDirectoriesForPathGenerator(pathToScan, maxDepth, exclude)];
}

/**
 * Gets all the directories included in this path
 * @param pathToScan - the path to scan provided by the user
 * @param maxDepth? - An optional `maxDepth` argument can be provided to limit how deep in the file tree the search will go.
 * @param exclude? - An optional comma-separated list of directories/files to exclude
 * @returns {Generator<string>} - a generator which yields the filepaths for the path to scan
 */
function* getAllDirectoriesForPathGenerator(
  pathToScan: string,
  maxDepth?: number,
  exclude?: string,
): Generator<string> {
  const excludeList = exclude
    ? exclude.split(',').map((item) => item.trim())
    : [];

  for (const filePath of makeFileAndDirectoryGenerator(pathToScan, maxDepth)) {
    if (filePath.directory && !isExcluded(filePath.directory, excludeList)) {
      yield filePath.directory;
    }
  }
}

/**
 * Gets all file paths for the specific directory
 * @param pathToScan - the path to scan provided by the user
 * @param currentDirectory - the directory which we want to return files for
 * @param exclude? - An optional comma-separated list of directories/files to exclude
 * @returns {string[]} An array with all the Terraform filePaths for this directory
 */
export function getFilesForDirectory(
  pathToScan: string,
  currentDirectory: string,
  exclude?: string,
): string[] {
  if (!isLocalFolder(pathToScan)) {
    if (
      shouldBeParsed(pathToScan) &&
      !isIgnoredFile(pathToScan, currentDirectory)
    ) {
      return [pathToScan];
    }
    return [];
  } else {
    return [...getFilesForDirectoryGenerator(currentDirectory, exclude)];
  }
}

/**
 * Iterates through the makeFileAndDirectoryGenerator function and gets all the Terraform files in the specified directory
 * @param pathToScan - the pathToScan to scan provided by the user
 * @param exclude? - An optional comma-separated list of directories/files to exclude
 * @returns {Generator<string>} - a generator which holds all the filepaths
 */
export function* getFilesForDirectoryGenerator(
  pathToScan: string,
  exclude?: string,
): Generator<string> {
  const excludeList = exclude
    ? exclude.split(',').map((item) => item.trim())
    : [];

  for (const filePath of makeFileAndDirectoryGenerator(pathToScan)) {
    if (filePath.file && filePath.file.dir !== pathToScan) {
      // we want to get files that belong just to the current walking directory, not the ones in nested directories
      continue;
    }
    if (
      filePath.file &&
      shouldBeParsed(filePath.file.fileName) &&
      !isIgnoredFile(filePath.file.fileName, pathToScan) &&
      !isExcluded(filePath.file.fileName, excludeList)
    ) {
      yield filePath.file.fileName;
    }
  }
}

export const shouldBeParsed = (pathToScan: string): boolean =>
  VALID_FILE_TYPES.includes(getFileType(pathToScan));

export const getFileType = (pathToScan: string): string => {
  const extension = path.extname(pathToScan);
  if (extension.startsWith('.')) {
    return extension.substr(1);
  }
  return extension;
};

/**
 * Checks if a file should be ignored from loading or not according to the filetype.
 * We ignore the same files that Terraform ignores.
 * https://github.com/hashicorp/terraform/blob/dc63fda44b67300d5161dabcd803426d0d2f468e/internal/configs/parser_config_dir.go#L137-L143
 * @param {string}  pathToScan - The filepath to check
 * @param {currentDirectory} currentDirectory - The directory for the filepath
 * @returns {boolean} if the filepath should be ignored or not
 */
function isIgnoredFile(pathToScan: string, currentDirectory: string): boolean {
  // we resolve the path in case the user tries to scan a single file with a relative path
  // e.g. './my-folder/terraform.tf', or '../my-folder/terraform.tf'
  const resolvedPath = path.resolve(currentDirectory, currentDirectory);
  return (
    resolvedPath.startsWith('.') || // Unix-like hidden files
    resolvedPath.startsWith('~') || // vim
    (resolvedPath.startsWith('#') && resolvedPath.endsWith('#')) // emacs
  );
}

/**
 * Checks if a file or directory should be excluded based on the exclude list
 * @param filePath - The file or directory path to check
 * @param excludeList - Array of paths to exclude (relative to working directory)
 * @returns {boolean} if the file/directory should be excluded
 */
function isExcluded(filePath: string, excludeList: string[]): boolean {
  if (excludeList.length === 0) {
    return false;
  }

  const relativePath = path.relative(process.cwd(), filePath);

  return excludeList.some((excludePattern) => {
    // Normalize paths to handle different separators and resolve relative paths
    const normalizedExcludePattern = path.normalize(excludePattern);
    const normalizedFilePath = path.normalize(relativePath);

    // Check if the file path is exactly the exclude pattern
    if (normalizedFilePath === normalizedExcludePattern) {
      return true;
    }

    // Check if the file path is inside the excluded directory
    // This handles cases like excludePattern="test-dir" and filePath="test-dir/subdir/file.tf"
    const relativeToExclude = path.relative(
      normalizedExcludePattern,
      normalizedFilePath,
    );
    if (
      !relativeToExclude.startsWith('..') &&
      relativeToExclude !== normalizedFilePath
    ) {
      return true;
    }

    return false;
  });
}
