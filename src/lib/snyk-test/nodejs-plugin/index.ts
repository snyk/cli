import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import {PkgTree} from 'snyk-nodejs-lockfile-parser';

export async function inspect(root: string, targetFile: string, options: any = {}): Promise<PkgTree> {
  const isLockFileBased = (targetFile.endsWith('package-lock.json') || targetFile.endsWith('yarn.lock'));
  // TODO(kyegupov): drop Node < 6 support
  if (targetFile.endsWith('yarn.lock') && getRuntimeVersion() < 6) {
    options.traverseNodeModules = true;
  }

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  return getLockFileDeps ?
    await lockParser.parse(root, targetFile, options) :
    await modulesParser.parse(root, targetFile, options);
}

function getRuntimeVersion() {
  return parseInt(process.version.slice(1).split('.')[0], 10);
}
