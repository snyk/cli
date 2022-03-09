import * as fs from 'fs';
import { join } from 'path';
import { readdirSync } from 'fs';
import * as path from 'path';
import { VALID_TERRAFORM_FILE_TYPES } from './types';

/**
 * makeFileAndDirectoryGenerator is a generator function that helps walking the directory and file structure of this pathToScan
 * @param root
 * @param maxDepth? - An optional `maxDepth` argument can be provided to limit how deep in the file tree the search will go.
 * @returns {Generator<object>} - a generator which yields an object with directories or paths for the path to scan
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function* makeFileAndDirectoryGenerator(root = '.', maxDepth?: number) {
  function* generatorHelper(pathToScan, currentDepth) {
    {
      yield { directory: pathToScan };
    }
    if (maxDepth !== currentDepth) {
      for (const dirent of readdirSync(pathToScan, { withFileTypes: true })) {
        if (
          dirent.isDirectory() &&
          fs.readdirSync(join(pathToScan, dirent.name)).length !== 0
        ) {
          yield* generatorHelper(
            join(pathToScan, dirent.name),
            currentDepth + 1,
          );
        } else if (dirent.isFile()) {
          yield {
            file: {
              dir: pathToScan,
              fileName: join(pathToScan, dirent.name),
            },
          };
        }
      }
    }
  }
  yield* generatorHelper(root, 1);
}

export const getExtensionForPath = (pathToScan: string) =>
  path.extname(pathToScan).toLowerCase();

export const shouldBeParsed = (pathToScan: string): boolean =>
  VALID_TERRAFORM_FILE_TYPES.includes(getExtensionForPath(pathToScan));

export const isSingleFile = (pathToScan: string): boolean =>
  !!getExtensionForPath(pathToScan);

/**
 * Checks if a file should be ignored from loading or not according to the filetype.
 * We ignore the same files that Terraform ignores.
 * https://github.com/hashicorp/terraform/blob/dc63fda44b67300d5161dabcd803426d0d2f468e/internal/configs/parser_config_dir.go#L137-L143
 * @param {string}  pathToScan - The filepath to check
 * @returns {boolean} if the filepath should be ignored or not
 */
export function isIgnoredFile(pathToScan: string): boolean {
  // we normalise the path in case the user tries to scan a single file with a relative path
  // e.g. './my-folder/terraform.tf'
  const normalisedPath = path.normalize(pathToScan);
  return (
    normalisedPath.startsWith('.') || // Unix-like hidden files
    normalisedPath.startsWith('~') || // vim
    (normalisedPath.startsWith('#') && normalisedPath.endsWith('#')) // emacs
  );
}
