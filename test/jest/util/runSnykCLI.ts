import { CLI_BIN_PATH } from './constants';
import { runCommand, RunCommandOptions, RunCommandResult } from './runCommand';

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
  return await runCommand('node', [CLI_BIN_PATH, ...args], options);
};

export { runSnykCLI, runSnykCLIWithArray };
