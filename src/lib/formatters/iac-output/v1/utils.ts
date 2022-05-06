import { execSync } from 'child_process';

export function getRepoRoot() {
  const cwd = process.cwd();
  const stdout = execSync('git rev-parse --show-toplevel', {
    encoding: 'utf8',
    cwd,
  });
  return stdout.trim() + '/';
}
