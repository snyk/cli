import * as path from 'path';
import {
  runCommand,
  runCommandsWithUserInputs,
  RunCommandResult,
  RunCommandOptions,
} from './runCommand';

const cwd = process.cwd();

const runSnykCLI = async (
  argsString: string,
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  const cliPath = path.resolve(cwd, './bin/snyk');
  const args = argsString.split(' ').filter((v) => !!v);
  return await runCommand('node', [cliPath, ...args], options);
};

const runSnykCLIWithArray = async (
  args: string[],
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  const cliPath = path.resolve(cwd, './bin/snyk');
  return await runCommand('node', [cliPath, ...args], options);
};

const runSnykCLIWithUserInputs = async (
  argsString: string,
  inputs: string[],
  options?: RunCommandOptions,
): Promise<any> => {
  const cliPath = path.resolve(cwd, './bin/snyk');
  const args = argsString.split(' ').filter((v) => !!v);
  return await runCommandsWithUserInputs(
    'node',
    [cliPath, ...args],
    inputs,
    options,
  );
};

export { runSnykCLI, runSnykCLIWithArray, runSnykCLIWithUserInputs };
