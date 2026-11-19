import { statSync } from 'fs';
import { dirname } from 'path';
import * as childProcess from 'child_process';

export function getRepositoryRootForPath(p: string) {
  return getRepositoryRoot(getWorkingDirectoryForPath(p));
}

export function getRepositoryRoot(cwd?: string) {
  const proc = childProcess.spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
  });
  if (proc.status !== 0) {
    throw new Error();
  }
  return proc.stdout.toString().trim();
}

export function getWorkingDirectoryForPath(p: string) {
  if (statSync(p).isDirectory()) {
    return p;
  }
  return dirname(p);
}
