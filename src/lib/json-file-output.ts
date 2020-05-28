import { gte } from 'semver';
import { existsSync, mkdirSync, createWriteStream } from 'fs';

export const MIN_VERSION_FOR_MKDIR_RECURSIVE = '10.12.0';

/**
 * Attempts to create a directory and fails quietly if it cannot. Rather than throwing errors it logs them to stderr and returns false.
 * It will attempt to recursively nested direcotry (ex `mkdir -p` style) if it needs to but will fail to do so with Node < 10 LTS.
 * @param newDirectoryFullPath the full path to a directory to create
 * @returns true if either the directory already exists or it is successful in creating one or false if it fails to create it.
 */
export function createDirectory(newDirectoryFullPath: string): boolean {
  // if the path already exists, true
  // if we successfully create the directory, return true
  // if we can't successfully create the directory, either because node < 10 and recursive or some other failure, catch the error and return false

  if (existsSync(newDirectoryFullPath)) {
    return true;
  }

  const nodeVersion = process.version;

  try {
    if (gte(nodeVersion, MIN_VERSION_FOR_MKDIR_RECURSIVE)) {
      // nodeVersion is >= 10.12.0 - required for mkdirsync recursive
      const options: any = { recursive: true }; // TODO: remove this after we drop support for node v8
      mkdirSync(newDirectoryFullPath, options);
      return true;
    } else {
      // nodeVersion is < 10.12.0
      mkdirSync(newDirectoryFullPath);
      return true;
    }
  } catch (err) {
    console.error(err);
    console.error(`could not create directory ${newDirectoryFullPath}`);
    return false;
  }
}

export function writeContentsToFileSwallowingErrors(
  jsonOutputFile: string,
  contents: string,
) {
  try {
    const ws = createWriteStream(jsonOutputFile, { flags: 'w' });
    ws.on('error', (err) => {
      console.error(err);
    });
    ws.write(contents);
    ws.end('\n');
  } catch (err) {
    console.error(err);
  }
}
