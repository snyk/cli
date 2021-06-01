import * as path from 'path';
import { runCommand, RunCommandResult, RunCommandOptions } from './runCommand';

const cwd = process.cwd();

const runSnykCLI = async (
  args,
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  const cliAbsPath = path.resolve(cwd, './dist/cli/index.js');
  return await runCommand('node', [cliAbsPath, ...args.split(' ')], options);
};

export { runSnykCLI };
