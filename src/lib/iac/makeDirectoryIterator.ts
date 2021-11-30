import fs from 'fs';
import { resolve } from 'path';

/**
 * Walk the provided directory tree, depth first, yielding the matched filename
 * to the caller. An optional `maxDepth` argument can be provided to limit how
 * deep in the file tree the search will go.
 */
export function* makeDirectoryIterator(
  root: string,
  options: { maxDepth?: number; includeDotfiles?: boolean } = {},
) {
  if (!isDirectory(root)) {
    throw new Error(`Path "${root}" is not a directory`);
  }

  // Internal function to allow us to track the recursion depth.
  function* walk(dirpath: string, currentDepth: number) {
    const filenames = fs.readdirSync(dirpath);
    for (const filename of filenames) {
      // NOTE: We filter filenames that start with a period to maintain
      // backwards compatibility with the original implementation that used the
      // "glob" package.
      if (!options.includeDotfiles && filename.startsWith('.')) {
        continue;
      }

      const resolved = resolve(dirpath, filename);
      if (isDirectory(resolved)) {
        // Skip this directory if max depth has been reached.
        if (options.maxDepth === currentDepth) {
          continue;
        }

        yield* walk(resolved, currentDepth + 1);
      } else {
        yield resolved;
      }
    }
  }

  yield* walk(root, 1);
}

// NOTE: We use isDirectory here instead of isLocalFolder() in order to
// follow symlinks and match the original glob() implementation.
function isDirectory(path: string): boolean {
  try {
    // statSync will resolve symlinks, lstatSync will not.
    return fs.statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}
