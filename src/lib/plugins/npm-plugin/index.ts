import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from '../types';

export async function inspect(root: string, targetFile: string, options: types.Options = {}):
Promise<types.InspectResult> {
  const isLockFileBased = (targetFile.endsWith('package-lock.json') || targetFile.endsWith('yarn.lock'));
  if (targetFile.endsWith('yarn.lock') && getRuntimeVersion() < 6) {
    options.traverseNodeModules = true;
  }

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

function getRuntimeVersion() {
  return parseInt(process.version.slice(1).split('.')[0], 10);
}
