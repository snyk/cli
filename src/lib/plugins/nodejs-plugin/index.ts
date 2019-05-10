import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from '../types';

export async function inspect(root: string, targetFile: string, options: types.Options = {}):
Promise<types.InspectResult> {
  const isLockFileBased = (targetFile.endsWith('package-lock.json') || targetFile.endsWith('yarn.lock'));

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  return {
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: process.version,
    },
    package: getLockFileDeps ?
      await lockParser.parse(root, targetFile, options) :
      await modulesParser.parse(root, targetFile, options),
  };
}
