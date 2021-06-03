import * as path from 'path';
import { runCommand, RunCommandResult, RunCommandOptions } from './runCommand';

const cwd = process.cwd();

const runSnykCLI = async (
  argsString: string,
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  const cliPath = path.resolve(cwd, './dist/cli/index.js');
  const args = argsString.split(' ').filter((v) => !!v);
  return await runCommand('node', [cliPath, ...args], options);
};

export { runSnykCLI };
