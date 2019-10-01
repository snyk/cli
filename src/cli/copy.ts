import { execSync } from 'child_process';

const program = {
  darwin: 'pbcopy',
  linux: 'xclip -selection clipboard',
  win32: 'clip',
}[process.platform];

export function copy(str) {
  return execSync(program, { input: str });
}
