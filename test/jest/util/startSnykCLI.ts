import {
  ChildProcessWithoutNullStreams,
  SpawnOptionsWithoutStdio,
} from 'child_process';
import { spawn } from 'cross-spawn';
import * as semver from 'semver';
import { Readable } from 'stream';
import { CLI_BIN_PATH } from './constants';

// https://nodejs.org/docs/latest-v16.x/api/child_process.html#event-spawn
const SUPPORTS_SPAWN_EVENT = semver.satisfies(process.version, '>=15.1.0');

// Timeout for a single assertion.
const DEFAULT_ASSERTION_TIMEOUT = 5_000;

// Timeout for the entire test.
const DEFAULT_TEST_TIMEOUT = 30_000;

class AssertionTimeoutError extends Error {
  constructor(context: string, timeout: number) {
    super(`${context} reached timeout (${timeout}ms)`);
  }
}

/**
 * Concatenates readable streams into a string while letting matchers hook into
 * it to check if the string contains a substring or regex.
 */
const createMatchableOutput = (outputStream: Readable) => {
  type OutputMatcher = () => void;

  let output = '';
  const matchers = new Set<OutputMatcher>();

  const waitUntilMatches = (
    expected: string | RegExp,
    { timeout = DEFAULT_ASSERTION_TIMEOUT } = {},
  ) => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        matchers.delete(matcher);
        reject(new AssertionTimeoutError('waitUntilMatches', timeout));
      }, timeout);

      const matches =
        typeof expected === 'string'
          ? () => output.includes(expected)
          : () => expected.test(output);

      const matcher = (): void => {
        if (matches()) {
          matchers.delete(matcher);
          clearTimeout(timeoutId);
          resolve();
        }
      };

      matchers.add(matcher);
      matcher();
    });
  };

  outputStream.on('data', (chunk) => {
    output += chunk.toString();
    for (const matcher of matchers) {
      matcher();
    }
  });

  return {
    waitUntilMatches,
    get: (): string => output,
  };
};

export type TestCLI = ReturnType<typeof createTestCLI>;

/**
 * A wrapper which provides helpers around a CLI process for tests to use.
 */
const createTestCLI = (child: ChildProcessWithoutNullStreams) => {
  const stdout = createMatchableOutput(child.stdout);
  const stderr = createMatchableOutput(child.stderr);

  /**
   * Waits for process to exit and provides the exit code.
   */
  const wait = async ({ timeout = DEFAULT_ASSERTION_TIMEOUT } = {}) => {
    if (child.killed) {
      return child.exitCode;
    }
    return new Promise((resolve, reject) => {
      const onTimeout = () => {
        child.removeListener('error', onError);
        child.removeListener('close', onClose);
        reject(new AssertionTimeoutError('wait', timeout));
      };
      const onError = (error) => {
        clearTimeout(timeoutId);
        reject(error);
      };
      const onClose = (code) => {
        clearTimeout(timeoutId);
        resolve(code || 0);
      };

      const timeoutId = setTimeout(onTimeout, timeout);
      child.once('error', onError);
      child.once('close', onClose);
    });
  };

  /**
   * Sends data through the process' stdin.
   */
  const input = async (input: string) => {
    return new Promise((resolve, reject) => {
      child.stdin.write(input, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  };

  /**
   * Sends data through the process' stdin and simulates the return/enter key
   * using a carriage return. Useful for answering questions from an interactive
   * command.
   */
  const answer = async (answer: string) => {
    return input(answer + '\r');
  };

  const stop = async () => {
    if (child.killed) {
      return;
    }
    child.kill('SIGKILL');
  };

  return {
    process: child,
    stdout,
    stderr,
    input,
    answer,
    stop,
    wait,
  };
};

type StartCommandOptions = SpawnOptionsWithoutStdio & {
  startTimeout?: number;
};

const startCommand = async (
  command: string,
  args: string[],
  {
    startTimeout = DEFAULT_ASSERTION_TIMEOUT,
    ...options
  }: StartCommandOptions = {},
): Promise<TestCLI> => {
  const child = spawn(command, args, options);
  return new Promise((resolve, reject) => {
    const onTimeout = () => {
      cleanup();
      reject(new AssertionTimeoutError('startCommand', startTimeout));
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const onSpawn = () => {
      cleanup();
      resolve(createTestCLI(child));
    };
    const cleanup = () => {
      child.removeListener('error', onError);
      child.removeListener('spawn', onSpawn);
      clearTimeout(timeoutId);
    };

    const timeoutId = setTimeout(onTimeout, startTimeout);
    child.once('error', onError);
    child.once('spawn', onSpawn);

    if (!SUPPORTS_SPAWN_EVENT) {
      const onInterval = () => {
        if (child.stdout.readable) {
          clearInterval(intervalId);
          onSpawn();
        }
      };
      const intervalId = setInterval(onInterval, 100);
      onInterval(); // check immediately
    }
  });
};

/**
 * Starts Snyk CLI and provides a test wrapper for performing typical actions
 * and assertions.
 */
export const startSnykCLI = async (
  argsString: string,
  options?: StartCommandOptions,
): Promise<TestCLI> => {
  const args = argsString.split(' ').filter((v) => !!v);
  if (process.env.TEST_SNYK_COMMAND) {
    return startCommand(process.env.TEST_SNYK_COMMAND, args, options);
  }
  return startCommand('node', [CLI_BIN_PATH, ...args], options);
};

type CustomMatcherOptions = { timeout?: number };

/**
 * Assume any test which imports this module wants to write acceptance tests.
 * So below we'll configure Jest with customer assertion matchers.
 *
 * When "pass" is true, "message" is used for expect().not. output, not for when
 * the matcher passes, but when it fails because of the .not. inversion!
 *
 * When .not. is used, we don't want to wait for the "not" case as we can wait
 * indefinitely for something not to happen. So the default timeout is set to 0,
 * meaning we immediately fail if the assertion is not true.
 *
 * Customer Matcher API: https://jestjs.io/docs/expect#expectextendmatchers
 */
expect.extend({
  /**
   * Waits for the process' stdout to display the given pattern.
   */
  async toDisplay(
    this: jest.MatcherUtils,
    cli: TestCLI,
    expected: string | RegExp,
    { timeout = this.isNot ? 0 : undefined }: CustomMatcherOptions = {},
  ) {
    try {
      await cli.stdout.waitUntilMatches(expected, { timeout });
      return {
        message: () => `expected process to not display "${expected}"`,
        pass: true,
      };
    } catch (err) {
      return {
        message: () =>
          `expected process to display "${expected}" (${err.message})`,
        pass: false,
      };
    }
  },
  /**
   * Waits for the process' stderr to display the given pattern.
   */
  async toDisplayError(
    this: jest.MatcherUtils,
    cli: TestCLI,
    expected: string,
    { timeout = this.isNot ? 0 : undefined }: CustomMatcherOptions = {},
  ) {
    try {
      await cli.stderr.waitUntilMatches(expected, { timeout });
      return {
        message: () => `expected process to not display error "${expected}"`,
        pass: true,
      };
    } catch (err) {
      return {
        message: () =>
          `expected process to display error "${expected}" (${err.message})`,
        pass: false,
      };
    }
  },
  /**
   * Waits for the process to exit and asserts its exit code.
   */
  async toExitWith(
    this: jest.MatcherUtils,
    cli: TestCLI,
    expected: number,
    { timeout = this.isNot ? 0 : undefined }: CustomMatcherOptions = {},
  ) {
    try {
      const actual = await cli.wait({ timeout });
      if (actual === expected) {
        return {
          message: () => `expected process to not exit with ${expected}.`,
          pass: true,
        };
      }
      return {
        message: () =>
          `expected process to exit with ${expected} but was ${actual}.`,
        pass: false,
      };
    } catch (err) {
      return {
        message: () =>
          `expected process to exit with ${expected} but did not exit. (${err.message})`,
        pass: false,
      };
    }
  },
});

/**
 * Async assertions have their own timeouts so we can increase Jest's default
 * timeout without making tests hang for too long.
 */
jest.setTimeout(DEFAULT_TEST_TIMEOUT);

/**
 * To use custom matchers, Jest will expose these methods when using expect().
 */
interface CustomMatchers<R = unknown> {
  /**
   * Waits for the process' stdout to display the given pattern.
   */
  toDisplay(expected: string, options?: CustomMatcherOptions): Promise<R>;
  /**
   * Waits for the process' stderr to display the given pattern.
   */
  toDisplayError(expected: string, options?: CustomMatcherOptions): Promise<R>;
  /**
   * Waits for the process to exit and asserts its exit code.
   */
  toExitWith(expected: number, options?: CustomMatcherOptions): Promise<R>;
}

/**
 * Disabling various linter errors because these lines are straight from Jest's
 * docs on how to declare custom matchers in TypeScript.
 *
 * Docs: https://jestjs.io/docs/expect#expectextendmatchers
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Expect extends CustomMatchers {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Matchers<R> extends CustomMatchers<R> {}
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}
