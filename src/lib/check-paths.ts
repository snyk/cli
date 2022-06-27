import {
  MissingTargetFileError,
  UnsupportedOptionCombinationError,
} from './errors';
import { isPathToPackageFile } from './detect';
import { Options } from './types';

// Throw error if user specifies package file name as part of path,
// and if user specifies multiple paths and used project-name option.
export function checkOSSPaths(paths: string[], options: Options) {
  let count = 0;
  for (const path of paths) {
    if (typeof path === 'string' && isPathToPackageFile(path)) {
      throw MissingTargetFileError(path);
    } else if (typeof path === 'string') {
      if (++count > 1 && options['project-name']) {
        throw new UnsupportedOptionCombinationError([
          'multiple paths',
          'project-name',
        ]);
      }
    }
  }
}
