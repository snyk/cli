import { execSync } from 'child_process';
import { statSync } from 'fs';
import { dirname } from 'path';

export function getRepositoryRootForPath(p: string) {
  return getRepositoryRoot(getWorkingDirectoryForPath(p));
}

export function getRepositoryRoot(cwd?: string) {
  const stdout = execSync('git rev-parse --show-toplevel', {
    encoding: 'utf8',
    cwd,
  });
  return stdout.trim();
}

function getWorkingDirectoryForPath(p: string) {
  if (statSync(p).isDirectory()) {
    return p;
  }
  return dirname(p);
}
