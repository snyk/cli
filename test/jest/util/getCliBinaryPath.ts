import { isAbsolute, join, normalize } from 'path';
import { cwd } from 'process';

export function getCliBinaryPath(): string {
  let command = process.env.TEST_SNYK_COMMAND || '';
  if (!command.startsWith('node') && !isAbsolute(command)) {
    command = normalize(join(cwd(), command));
  }
  return command;
}
