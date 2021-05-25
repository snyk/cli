import * as path from 'path';
import { runCommand, RunCommandResult } from '../util/runCommand';

type RunCLIResult = RunCommandResult;

const runCLI = async (
  args,
  workingDirectory?: string,
): Promise<RunCommandResult> => {
  const cliPath = path.normalize('./dist/cli/index.js');
  const cliAbsPath = path.resolve(process.cwd(), cliPath);
  const ops = {
    cwd: workingDirectory,
  };
  return await runCommand('node', [cliAbsPath, ...args.split(' ')], ops);
};

export { runCLI, RunCLIResult };
