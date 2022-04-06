import * as path from 'path';
import {
  runCommand,
  runCommandsWithUserInputs,
  RunCommandResult,
  RunCommandOptions,
} from './runCommand';

const CLI_BIN_SCRIPT = path.resolve(__dirname, '../../../bin/snyk');

const runSnykCLI = async (
  argsString: string,
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  return runSnykCLIWithArray(
    argsString.split(' ').filter((v) => !!v),
    options,
  );
};

const runSnykCLIWithArray = async (
  args: string[],
  options?: RunCommandOptions,
): Promise<RunCommandResult> => {
  if (process.env.TEST_SNYK_COMMAND) {
    return await runCommand(process.env.TEST_SNYK_COMMAND, args, options);
  }
  return await runCommand('node', [CLI_BIN_SCRIPT, ...args], options);
};

const runSnykCLIWithUserInputs = async (
  argsString: string,
  inputs: string[],
  options?: RunCommandOptions,
): Promise<any> => {
  const args = argsString.split(' ').filter((v) => !!v);
  if (process.env.TEST_SNYK_COMMAND) {
    return await runCommandsWithUserInputs(
      process.env.TEST_SNYK_COMMAND,
      args,
      inputs,
      options,
    );
  }
  return await runCommandsWithUserInputs(
    'node',
    [CLI_BIN_SCRIPT, ...args],
    inputs,
    options,
  );
};

export { runSnykCLI, runSnykCLIWithArray, runSnykCLIWithUserInputs };
