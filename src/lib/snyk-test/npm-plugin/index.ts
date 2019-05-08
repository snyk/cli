import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import {PkgTree} from 'snyk-nodejs-lockfile-parser';

export async function inspect(root: string, targetFile: string, options: any = {}): Promise<PkgTree> {
  const isLockFileBased = (targetFile.endsWith('package-lock.json') || targetFile.endsWith('yarn.lock'));

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  return getLockFileDeps ?
    await lockParser.parse(root, targetFile, options) :
    await modulesParser.parse(root, targetFile, options);
}
