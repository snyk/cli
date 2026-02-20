import { CLI_BIN_PATH } from './constants';
import { withFipsEnvIfNeeded } from './fipsTestHelper';
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
  options = { ...options, env: withFipsEnvIfNeeded(options?.env) };

  if (process.env.TEST_SNYK_COMMAND) {
    return await runCommand(process.env.TEST_SNYK_COMMAND, args, options);
  }
  console.log(
    `No Binary configured with TEST_SNYK_COMMAND, falling back to node`,
  );
  return await runCommand('node', [CLI_BIN_PATH, ...args], options);
};

export { runSnykCLI, runSnykCLIWithArray };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R = unknown> {
      /**
       * Assert that the received text includes the expected substring if whitespace is omited.
       * @param received The text to assert.
       * @param expected The substring to match.
       * @returns {boolean}
       */
      toContainText(expected: string): CustomMatcherResult;
    }
  }
}
