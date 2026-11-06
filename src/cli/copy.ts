import { execSync } from 'child_process';
import { cleanSnykEnv } from '@snyk/cli-interface';

const program = {
  darwin: 'pbcopy',
  linux: 'xclip -selection clipboard',
  win32: 'clip',
}[process.platform];

export function copy(str: string) {
  return execSync(program, {
    input: str,
    env: cleanSnykEnv({ ...process.env }),
  });
}
